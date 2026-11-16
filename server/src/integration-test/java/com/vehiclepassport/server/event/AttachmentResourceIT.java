package com.vehiclepassport.server.event;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.testsupport.fake.FakeEventDocumentStorage;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** HTTP shape of the attachment endpoints, against Postgres (Dev Services) and the fake object store. */
@QuarkusTest
@TestProfile(PersistenceProfile.class)
class AttachmentResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000a1";
    static final String LATER = "00000000-0000-0000-0000-0000000000a3";

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    ReleaseVehicleUseCase releasing;
    @Inject
    AddEventUseCase adding;
    @Inject
    AttachmentRepositoryPort attachments;
    @Inject
    FakeEventDocumentStorage storage;

    private String registerAs(String user) {
        String vin = EventTestVins.random();
        registerVin(user, vin);
        return vin;
    }

    private void registerVin(String user, String vin) {
        registering.register(new RegisterVehicleCommand(UUID.fromString(user), vin, "Dacia", "Duster", null, 2020,
                "DIESEL"));
    }

    private UUID eventAs(String user, String vin, String date, int km) {
        EventView v = adding.add(new AddEventCommand(UUID.fromString(user), vin, "SERVICE", LocalDate.parse(date), km,
                BigDecimal.TEN, "RON", null));
        return v.id();
    }

    private static byte[] pdf(String name) {
        return ("%PDF-1.4\n% " + name + "\n").getBytes(StandardCharsets.US_ASCII);
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static RequestSpecification upload(String fileName, byte[] bytes, String type) {
        return given().multiPart("file", fileName, bytes, type);
    }

    private static String attachments(String vin, UUID eventId) {
        return "/vehicles/" + vin + "/events/" + eventId + "/attachments";
    }

    @Test
    @TestSecurity(user = "a1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void add_201_then_list_open_and_delete() throws Exception {
        String vin = registerAs(ME);
        UUID event = eventAs(ME, vin, "2025-03-01", 1000);
        byte[] file = pdf("one");

        String id = upload("factura.pdf", file, "Application/PDF; name=factura")
                .when().post(attachments(vin, event))
                .then().statusCode(201)
                .body("id", notNullValue())
                .body("contentType", equalTo("application/pdf"))
                .body("sizeBytes", equalTo(file.length))
                .body("sha256", equalTo(sha256(file)))
                .body("kind", equalTo("UPLOAD"))
                .body("createdAt", notNullValue())
                .extract().path("id");

        given().when().get(attachments(vin, event))
                .then().statusCode(200).body("$", hasSize(1)).body("[0].id", equalTo(id));
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200)
                .body("items[0].attachmentCount", equalTo(1))
                .body("items[0].documentPresent", equalTo(true))
                .body("items[0].evidence", equalTo("USER_CONFIRMED"));
        byte[] served = given().when().get(attachments(vin, event) + "/" + id)
                .then().statusCode(200).contentType("application/pdf").extract().asByteArray();
        assertArrayEquals(file, served);

        given().when().delete(attachments(vin, event) + "/" + id).then().statusCode(204);
        given().when().get(attachments(vin, event)).then().statusCode(200).body("$", hasSize(0));
        given().when().get(attachments(vin, event) + "/" + id)
                .then().statusCode(404).body("code", equalTo("attachment-not-found"));
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200)
                .body("items[0].attachmentCount", equalTo(0))
                .body("items[0].documentPresent", equalTo(false));
    }

    @Test
    @TestSecurity(user = "a1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void same_file_on_another_event_of_the_vin_409_names_the_first_event() {
        String vin = registerAs(ME);
        UUID first = eventAs(ME, vin, "2025-03-01", 1000);
        UUID second = eventAs(ME, vin, "2025-04-01", 2000);
        upload("a.pdf", pdf("dup"), "application/pdf").when().post(attachments(vin, first)).then().statusCode(201);

        String detail = upload("b.pdf", pdf("dup"), "application/pdf").when().post(attachments(vin, second))
                .then().statusCode(409)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("duplicate-document"))
                .extract().path("detail");
        assertTrue(detail.contains(first.toString()), detail);
        assertFalse(detail.contains("null"), detail);
    }

    @Test
    @TestSecurity(user = "a1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void text_declared_as_pdf_415_and_missing_part_400() {
        String vin = registerAs(ME);
        UUID event = eventAs(ME, vin, "2025-03-01", 1000);

        upload("notes.pdf", "plain text".getBytes(StandardCharsets.UTF_8), "application/pdf")
                .when().post(attachments(vin, event))
                .then().statusCode(415).body("code", equalTo("unsupported-file"));
        given().multiPart("other", "x").when().post(attachments(vin, event))
                .then().statusCode(400).body("code", equalTo("validation-failed"));
        given().when().get(attachments(vin, event)).then().statusCode(200).body("$", hasSize(0));
    }

    @Test
    @TestSecurity(user = "a3")
    @OidcSecurity(claims = @Claim(key = "sub", value = LATER))
    void later_owner_403_on_add_list_and_open() {
        String vin = registerAs(ME);
        UUID event = eventAs(ME, vin, "2025-03-01", 1000);
        UUID attachment = saveRow(vin, event, "application/pdf", pdf("prior"));
        releasing.release(vin, UUID.fromString(ME));
        registerVin(LATER, vin);

        upload("x.pdf", pdf("mine"), "application/pdf").when().post(attachments(vin, event))
                .then().statusCode(403).body("code", equalTo("event-from-prior-owner"));
        given().when().get(attachments(vin, event))
                .then().statusCode(403).body("code", equalTo("document-restricted"));
        given().when().get(attachments(vin, event) + "/" + attachment)
                .then().statusCode(403).body("code", equalTo("document-restricted"));
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items[0].attachmentCount", equalTo(1));
    }

    @Test
    @TestSecurity(user = "a1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void legacy_scan_source_lists_its_real_type_and_a_null_hash_and_is_protected() {
        String vin = registerAs(ME);
        UUID event = eventAs(ME, vin, "2025-03-01", 1000);
        UUID legacy = saveRow(vin, event, "application/octet-stream", pdf("legacy"));

        given().when().get(attachments(vin, event))
                .then().statusCode(200)
                .body("[0].id", equalTo(legacy.toString()))
                .body("[0].contentType", equalTo("application/pdf"))
                .body("[0].contentType", not(equalTo("application/octet-stream")))
                .body("[0].sha256", nullValue())
                .body("[0].kind", equalTo("SCAN_SOURCE"));
        given().when().delete(attachments(vin, event) + "/" + legacy)
                .then().statusCode(422).body("code", equalTo("attachment-protected"));
    }

    @Test
    @TestSecurity(user = "a1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void deprecated_document_alias_returns_the_first_attachment() {
        String vin = registerAs(ME);
        UUID event = eventAs(ME, vin, "2025-03-01", 1000);
        upload("1.pdf", pdf("first"), "application/pdf").when().post(attachments(vin, event)).then().statusCode(201);
        upload("2.pdf", pdf("second"), "application/pdf").when().post(attachments(vin, event)).then().statusCode(201);

        byte[] served = given().when().get("/vehicles/" + vin + "/events/" + event + "/document")
                .then().statusCode(200).contentType("application/pdf").extract().asByteArray();
        assertArrayEquals(pdf("first"), served);
    }

    /** A row written straight through the port, as the V6 backfill or a confirmed scan leaves it. */
    private UUID saveRow(String vin, UUID event, String type, byte[] content) {
        UUID id = UUID.randomUUID();
        String key = "legacy/" + vin + "/" + id;
        storage.put(key, content, "application/pdf");
        QuarkusTransaction.requiringNew().run(() -> attachments.save(new Attachment(id, event, vin,
                null, type, 0, key, AttachmentKind.SCAN_SOURCE, UUID.fromString(ME), Instant.now(), null)));
        return id;
    }
}
