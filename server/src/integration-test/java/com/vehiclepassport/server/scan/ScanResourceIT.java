package com.vehiclepassport.server.scan;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.scan.ScanTestSupport.Fixture;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.testsupport.fake.FakeScanDocumentStorage;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class ScanResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000f1";
    static final String OTHER = "00000000-0000-0000-0000-0000000000f2";
    private static final byte[] PNG = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02, 0x03};
    private static final String CONFIRM_BODY =
            "{\"date\":\"2025-06-01\",\"odometerKm\":120000,\"total\":400.00,\"serviceName\":\"Auto Service\","
                    + "\"parts\":[{\"name\":\"Oil filter\",\"qty\":1,\"price\":300}],\"labor\":100}";

    @Inject
    ScanTestSupport support;
    @Inject
    FakeScanDocumentStorage storage;
    @Inject
    ReleaseVehicleUseCase releasing;
    @Inject
    AddEventUseCase adding;
    @Inject
    ReadVehicleHistoryUseCase history;

    private Fixture mine() {
        return support.register(UUID.fromString(ME));
    }

    private static RequestSpecification upload(String part, String fileName, byte[] bytes, String type) {
        return given().multiPart(part, fileName, bytes, type);
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_scan_202_pending() {
        Fixture f = mine();
        storage.reset();

        upload("file", "receipt.png", PNG, "image/png")
                .when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(202)
                .body("id", notNullValue())
                .body("status", equalTo("PENDING"))
                .body("warnings", hasSize(0));

        assertEquals(1, storage.keys().size());
        assertTrue(storage.keys().iterator().next().startsWith("scans/" + f.vin() + "/"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_gif_415() {
        Fixture f = mine();

        upload("file", "x.gif", new byte[] {'G', 'I', 'F', '8', '9', 'a', 0}, "image/gif")
                .when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(415).body("code", equalTo("unsupported-file"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void hostile_name_with_bytes_that_do_not_match_the_declared_type_is_415_and_never_stored() {
        Fixture f = mine();
        storage.reset();

        upload("file", "../../x.pdf", PNG, "application/pdf")
                .when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(415).body("code", equalTo("unsupported-file"));

        assertTrue(storage.keys().isEmpty());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void hostile_name_never_reaches_the_storage_key() {
        Fixture f = mine();
        storage.reset();

        upload("file", "../../x.png", PNG, "image/png")
                .when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(202);

        String key = storage.keys().iterator().next();
        assertTrue(key.matches("scans/" + f.vin() + "/[0-9a-f-]{36}"), key);
        assertFalse(key.contains("x.png") || key.contains(".."), key);
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_11MB_413() throws Exception {
        Fixture f = mine();
        byte[] big = new byte[11 * 1024 * 1024];
        System.arraycopy(PNG, 0, big, 0, PNG.length);
        // Sent from a file: RestAssured's request log would otherwise render the 11 MB array as text (heap OOM).
        Path file = Files.createTempFile("big", ".png");
        Files.write(file, big);
        file.toFile().deleteOnExit();

        given().multiPart("file", file.toFile(), "image/png")
                .when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(413).body("code", equalTo("file-too-large"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void batch_202_one_job_per_file() {
        Fixture f = mine();
        RequestSpecification request = given();
        for (int i = 0; i < 2; i++) {
            request = request.multiPart("files", "r" + i + ".png", PNG, "image/png");
        }

        request.when().post("/vehicles/" + f.vin() + "/scan-batches")
                .then().statusCode(202).body("jobs", hasSize(2)).body("jobs[0].status", equalTo("PENDING"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void batch_21_422_code_batch_too_large() {
        Fixture f = mine();
        RequestSpecification request = given();
        for (int i = 0; i < 21; i++) {
            request = request.multiPart("files", "r" + i + ".png", PNG, "image/png");
        }

        request.when().post("/vehicles/" + f.vin() + "/scan-batches")
                .then().statusCode(422).body("code", equalTo("batch-too-large"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void batch_without_files_part_is_not_accepted() {
        Fixture f = mine();

        given().multiPart("other", "x").when().post("/vehicles/" + f.vin() + "/scan-batches")
                .then().statusCode(422).body("code", equalTo("batch-too-large"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_without_file_part_400() {
        Fixture f = mine();

        given().multiPart("other", "x").when().post("/vehicles/" + f.vin() + "/scans")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = OTHER))
    void get_foreign_job_404() {
        ScanJob job = support.extracted(mine());

        given().when().get("/scans/" + job.id())
                .then().statusCode(404).body("code", equalTo("scan-not-found"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_extracted_returns_fields_and_warnings() {
        ScanJob job = support.extracted(mine());

        given().when().get("/scans/" + job.id())
                .then().statusCode(200)
                .body("status", equalTo("EXTRACTED"))
                .body("fields.serviceName.value", equalTo("Auto Service SRL"))
                .body("fields.date.value", equalTo("2025-06-01"))
                .body("fields.odometerKm.confidence", equalTo(0.8f))
                .body("fields.parts.value[0].name", equalTo("Oil filter"))
                .body("warnings[0].code", equalTo("TOTAL_MISMATCH"))
                .body("warnings[0].message", notNullValue());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_201_event_id() {
        Fixture f = mine();
        ScanJob job = support.extracted(f);

        String eventId = given().contentType(ContentType.JSON).body(CONFIRM_BODY)
                .when().post("/scans/" + job.id() + "/confirm")
                .then().statusCode(201).body("eventId", notNullValue()).extract().path("eventId");

        assertEquals(ScanStatus.CONFIRMED, support.reload(job.id()).status());
        assertEquals(1, history.history(f.vin()).size());
        assertEquals("DOCUMENTED", history.history(f.vin()).get(0).evidence());
        assertEquals(1, history.history(f.vin()).get(0).attachmentCount());

        // The scanned file is the event's protected SCAN_SOURCE, carrying the hash and size recorded at submit.
        String attachments = "/vehicles/" + f.vin() + "/events/" + eventId + "/attachments";
        String sourceId = given().when().get(attachments)
                .then().statusCode(200)
                .body("$", hasSize(1))
                .body("[0].kind", equalTo("SCAN_SOURCE"))
                .body("[0].sha256", equalTo(job.sha256()))
                .body("[0].sizeBytes", equalTo((int) job.sizeBytes()))
                .body("[0].contentType", equalTo(job.contentType()))
                .extract().path("[0].id");
        given().when().delete(attachments + "/" + sourceId)
                .then().statusCode(422).body("code", equalTo("attachment-protected"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_missing_km_400() {
        ScanJob job = support.extracted(mine());

        given().contentType(ContentType.JSON).body("{\"date\":\"2025-06-01\",\"total\":400}")
                .when().post("/scans/" + job.id() + "/confirm")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_twice_409() {
        ScanJob job = support.extracted(mine());
        given().contentType(ContentType.JSON).body(CONFIRM_BODY).post("/scans/" + job.id() + "/confirm")
                .then().statusCode(201);

        given().contentType(ContentType.JSON).body(CONFIRM_BODY).post("/scans/" + job.id() + "/confirm")
                .then().statusCode(409).body("code", equalTo("scan-state-conflict"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void reject_204() {
        ScanJob job = support.extracted(mine());

        given().when().post("/scans/" + job.id() + "/reject").then().statusCode(204);

        assertEquals(ScanStatus.REJECTED, support.reload(job.id()).status());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_that_fails_odometer_check_saves_no_event_and_leaves_the_job_extracted() {
        Fixture f = mine();
        adding.add(new AddEventCommand(UUID.fromString(ME), f.vin(), new EventInput("SERVICE",
                LocalDate.parse("2025-01-01"), 100000, new BigDecimal("10.00"), "RON", null, null, null, null, null,
                null, null)));
        ScanJob job = support.extracted(f);
        int before = history.history(f.vin()).size();

        // 50 000 km five months after a 100 000 km reading
        given().contentType(ContentType.JSON)
                .body("{\"date\":\"2025-06-01\",\"odometerKm\":50000,\"total\":400}")
                .when().post("/scans/" + job.id() + "/confirm")
                .then().statusCode(422).body("code", equalTo("odometer-inconsistent"));

        assertEquals(before, history.history(f.vin()).size());
        assertEquals(ScanStatus.EXTRACTED, support.reload(job.id()).status());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void cancellation_made_in_its_own_transaction_survives_the_refusal() {
        Fixture f = mine();
        ScanJob job = support.extracted(f);
        releasing.release(f.vin(), UUID.fromString(ME));

        given().contentType(ContentType.JSON).body(CONFIRM_BODY)
                .when().post("/scans/" + job.id() + "/confirm")
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));

        assertEquals(ScanStatus.CANCELLED, support.reload(job.id()).status());
        assertEquals(0, history.history(f.vin()).size());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_after_release_cancels_the_job() {
        Fixture f = mine();
        ScanJob job = support.extracted(f);
        releasing.release(f.vin(), UUID.fromString(ME));

        given().when().get("/scans/" + job.id()).then().statusCode(200).body("status", equalTo("CANCELLED"));

        assertEquals(ScanStatus.CANCELLED, support.reload(job.id()).status());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void lowercase_vin_submit_202_and_the_object_is_stored_under_the_canonical_vin() {
        Fixture f = mine();
        storage.reset();

        upload("file", "receipt.png", PNG, "image/png")
                .when().post("/vehicles/" + f.vin().toLowerCase() + "/scans")
                .then().statusCode(202).body("status", equalTo("PENDING"));

        assertEquals(1, storage.keys().size());
        assertTrue(storage.keys().iterator().next().startsWith("scans/" + f.vin() + "/"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_itp_with_valid_until_and_result_201() {
        Fixture f = mine();
        ScanJob job = support.extracted(f);
        given().contentType(ContentType.JSON).body("{\"type\":\"ITP\",\"date\":\"2025-06-01\",\"odometerKm\":120000,"
                        + "\"total\":150,\"serviceName\":\"RAR Iasi\",\"validUntil\":\"2027-06-01\","
                        + "\"itpResult\":\"PASSED\"}")
                .when().post("/scans/" + job.id() + "/confirm")
                .then().statusCode(201);
        given().when().get("/vehicles/" + f.vin() + "/timeline").then().statusCode(200)
                .body("items[0].details.kind", equalTo("ITP"))
                .body("items[0].details.station", equalTo("RAR Iasi"))
                .body("items[0].details.result", equalTo("PASSED"))
                .body("items[0].validUntil", equalTo("2027-06-01"))
                .body("items[0].evidence", equalTo("DOCUMENTED"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void confirm_refuses_itp_fields_on_other_types_long_station_and_non_scan_types_400() {
        Fixture f = mine();
        ScanJob job = support.extracted(f);
        String head = "{\"date\":\"2025-06-01\",\"odometerKm\":120000,\"total\":1,";
        for (String body : new String[] {
                head + "\"type\":\"SERVICE\",\"validUntil\":\"2027-01-01\"}",
                head + "\"itpResult\":\"PASSED\"}",
                head + "\"type\":\"ITP\",\"serviceName\":\"" + "s".repeat(101) + "\"}",
                head + "\"type\":\"ROVINIETA\"}"}) {
            given().contentType(ContentType.JSON).body(body)
                    .when().post("/scans/" + job.id() + "/confirm")
                    .then().statusCode(400).body("code", equalTo("validation-failed"));
        }
        assertEquals(ScanStatus.EXTRACTED, support.reload(job.id()).status());
        assertEquals(0, history.history(f.vin()).size());
    }
}
