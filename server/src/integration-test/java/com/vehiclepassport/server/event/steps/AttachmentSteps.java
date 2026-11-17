package com.vehiclepassport.server.event.steps;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.AttachmentUpload;
import com.vehiclepassport.server.event.application.port.in.AttachmentView;
import com.vehiclepassport.server.event.application.port.in.DeleteAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetEventDocumentUseCase;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.TimelineQuery;
import com.vehiclepassport.server.event.application.port.in.ListAttachmentsUseCase;
import com.vehiclepassport.server.event.application.port.in.OpenAttachmentUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakeScanDocumentStorage;
import com.vehiclepassport.server.testsupport.fake.FakeScanJobRepository;
import com.vehiclepassport.server.testsupport.fake.TestClock;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AttachmentSteps {

    private static final String VIN = "WVWZZZ1JZXW000001"; // V, shared with the other event and scan steps
    private static final String OTHER_VIN = "WVWZZZ1JZXW000002"; // W
    private static final String OWNED_KEY = "event.owned"; // shared with EventSteps and ReviewSteps
    private static final String JOB_KEY = "scan.job"; // shared with ScanSteps and ReviewSteps
    private static final String CONFIRMED_EVENT_KEY = "review.eventId"; // shared with ReviewSteps
    private static final String E_KEY = "attachment.e";
    private static final String F_KEY = "attachment.f";
    private static final String OWNER_KEY = "attachment.owner";
    private static final String RESULT_KEY = "attachment.result";
    private static final String DOCUMENT_KEY = "attachment.document";

    @Inject
    World world;
    @Inject
    AddEventUseCase addEvent;
    @Inject
    AddAttachmentUseCase adding;
    @Inject
    ListAttachmentsUseCase listing;
    @Inject
    OpenAttachmentUseCase opening;
    @Inject
    DeleteAttachmentUseCase deleting;
    @Inject
    GetEventDocumentUseCase eventDocument;
    @Inject
    GetTimelineUseCase timeline;
    @Inject
    RegisterVehicleUseCase register;
    @Inject
    ReleaseVehicleUseCase release;
    @Inject
    FakeScanJobRepository jobs;
    @Inject
    FakeScanDocumentStorage scanStorage;
    @Inject
    TestClock clock;

    @Given("I own vehicle V with an event E")
    public void iOwnVWithAnEventE() {
        ownAsMe();
        world.put(E_KEY, addEventAs(world.me(), VIN, "2025-03-01", 120000));
    }

    @Given("I own vehicle V with events E and F")
    public void iOwnVWithEventsEAndF() {
        ownAsMe();
        world.put(E_KEY, addEventAs(world.me(), VIN, "2025-03-01", 120000));
        world.put(F_KEY, addEventAs(world.me(), VIN, "2025-04-01", 121000));
    }

    @Given("the PDF file {string} is attached to E")
    public void thePdfFileIsAttachedToE(String name) {
        attach(world.me(), VIN, world.get(E_KEY), pdf(name), "application/pdf");
    }

    @Given("{int} different PDF files are attached to E")
    public void differentPdfFilesAreAttachedToE(int count) {
        for (int i = 1; i <= count; i++) {
            attach(world.me(), VIN, world.get(E_KEY), pdf("receipt-" + i), "application/pdf");
        }
    }

    @Given("Alice owns vehicle W with an event that has the PDF file {string} attached")
    public void aliceOwnsWWithAnAttachedEvent(String name) {
        UUID alice = world.user("Alice");
        registerAs(alice, OTHER_VIN);
        UUID event = addEventAs(alice, OTHER_VIN, "2025-03-01", 50000);
        attach(alice, OTHER_VIN, event, pdf(name), "application/pdf");
    }

    @Given("Alice attached the PDF file {string} to event E, then ownership of V moved to me")
    public void aliceAttachedThenOwnershipMoved(String name) {
        UUID alice = world.user("Alice");
        registerAs(alice, VIN);
        UUID event = addEventAs(alice, VIN, "2025-03-01", 120000);
        world.put(E_KEY, event);
        world.put(OWNER_KEY, attach(alice, VIN, event, pdf(name), "application/pdf").id());
        release.release(VIN, alice);
        registerAs(world.me(), VIN);
        world.put(OWNED_KEY, true);
    }

    @Given("I add an event F to V")
    public void iAddAnEventFToV() {
        world.put(F_KEY, addEventAs(world.me(), VIN, "2025-06-01", 130000));
    }

    @When("I attach the PDF file {string} to {word}")
    public void iAttachThePdfFileTo(String name, String event) {
        UUID id = world.get(event.equals("F") ? F_KEY : E_KEY);
        world.attempt(() -> world.put(RESULT_KEY, attach(world.me(), VIN, id, pdf(name), "application/pdf")));
    }

    @When("I attach a text file declared as {string} to E")
    public void iAttachATextFile(String declared) {
        byte[] text = "just some notes, not a receipt".getBytes(StandardCharsets.UTF_8);
        world.attempt(() -> world.put(RESULT_KEY, attach(world.me(), VIN, world.get(E_KEY), text, declared)));
    }

    @When("I open Alice's attachment of E")
    public void iOpenAlicesAttachment() {
        UUID attachment = world.get(OWNER_KEY);
        world.attempt(() -> opening.open(world.me(), VIN, world.get(E_KEY), attachment));
    }

    @When("I delete that attachment")
    public void iDeleteThatAttachment() {
        AttachmentView added = world.get(RESULT_KEY);
        world.attempt(() -> deleting.delete(world.me(), VIN, world.get(E_KEY), added.id()));
        assertNoError();
    }

    @When("I delete the SCAN_SOURCE attachment of the confirmed event")
    public void iDeleteTheScanSource() {
        UUID event = world.get(CONFIRMED_EVENT_KEY);
        AttachmentView source = listing.list(world.me(), VIN, event).get(0);
        world.attempt(() -> deleting.delete(world.me(), VIN, event, source.id()));
    }

    @When("I request E's document through the deprecated alias")
    public void iRequestEsDocument() {
        world.attempt(() -> world.put(DOCUMENT_KEY, eventDocument.get(world.me(), VIN, world.get(E_KEY))));
    }

    @Then("the attachment is stored with kind UPLOAD and the SHA-256 of {string}")
    public void theAttachmentIsStored(String name) {
        assertNoError();
        AttachmentView added = world.get(RESULT_KEY);
        assertEquals("UPLOAD", added.kind());
        assertEquals(sha256(pdf(name)), added.sha256());
        assertEquals(pdf(name).length, added.sizeBytes());
        assertEquals("application/pdf", added.contentType());
    }

    @Then("E lists {int} attachment(s)")
    public void eListsAttachments(int count) {
        assertEquals(count, listing.list(world.me(), VIN, world.get(E_KEY)).size());
    }

    @Then("opening that attachment returns the bytes of {string} as {string}")
    public void openingReturnsTheBytes(String name, String contentType) {
        AttachmentView added = world.get(RESULT_KEY);
        assertDocument(opening.open(world.me(), VIN, world.get(E_KEY), added.id()), name, contentType);
    }

    @Then("I receive the bytes of {string} as {string}")
    public void iReceiveTheBytes(String name, String contentType) {
        assertNoError();
        assertDocument(world.get(DOCUMENT_KEY), name, contentType);
    }

    @Then("the attachment request fails with {int} {string}")
    public void theAttachmentRequestFails(int status, String code) {
        DomainException e = assertInstanceOf(DomainException.class, world.lastError(),
                "expected a domain error, got " + world.lastError());
        assertEquals(code, e.code());
        assertEquals(status, e.kind().status());
    }

    @Then("the problem detail does not name E")
    public void theProblemDetailDoesNotNameE() {
        String detail = world.lastError().getMessage();
        assertFalse(detail.contains(world.<UUID>get(E_KEY).toString()), detail);
        assertFalse(detail.contains("null"), detail);
    }

    @Then("the problem detail names E")
    public void theProblemDetailNamesE() {
        String detail = world.lastError().getMessage();
        assertTrue(detail.contains(world.<UUID>get(E_KEY).toString()), detail);
        assertFalse(detail.contains("null"), detail);
    }

    @Then("the timeline shows E with {int} attachments, a document present and evidence {word}")
    public void theTimelineShowsE(int count, String evidence) {
        UUID id = world.get(E_KEY);
        EventView e = timeline.get(TimelineQuery.firstPage(world.me(), VIN, 100)).items().stream()
                .filter(v -> v.id().equals(id)).findFirst().orElseThrow();
        assertEquals(count, e.attachmentCount());
        assertTrue(e.documentPresent());
        assertEquals(evidence, e.evidence());
    }

    @Then("the confirmed event lists one SCAN_SOURCE attachment carrying the scanned file's SHA-256")
    public void theConfirmedEventListsAScanSource() {
        assertNoError();
        UUID event = world.get(CONFIRMED_EVENT_KEY);
        List<AttachmentView> listed = listing.list(world.me(), VIN, event);
        assertEquals(1, listed.size());
        AttachmentView source = listed.get(0);
        assertEquals("SCAN_SOURCE", source.kind());
        ScanJobView job = world.get(JOB_KEY);
        byte[] scanned = scanStorage.read(jobs.findById(job.id()).orElseThrow().documentKey());
        assertEquals(sha256(scanned), source.sha256());
        assertEquals(scanned.length, source.sizeBytes());
        assertEquals("image/png", source.contentType());
    }

    /** Each attachment gets its own creation instant, so "oldest first" is well defined. */
    private AttachmentView attach(UUID user, String vin, UUID event, byte[] bytes, String contentType) {
        clock.advance(Duration.ofSeconds(1));
        return adding.add(user, vin, event,
                new AttachmentUpload(new ByteArrayInputStream(bytes), contentType, bytes.length));
    }

    private static void assertDocument(EventDocument document, String name, String contentType) {
        assertNotNull(document);
        assertEquals(contentType, document.contentType());
        try (InputStream in = document.content()) {
            assertArrayEquals(pdf(name), in.readAllBytes());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        assertNull(error, String.valueOf(error));
    }

    private UUID addEventAs(UUID user, String vin, String date, int km) {
        EventView v = addEvent.add(new AddEventCommand(user, vin, new EventInput("SERVICE", LocalDate.parse(date), km,
                BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        return v.id();
    }

    private void ownAsMe() {
        if (world.get(OWNED_KEY) == null) {
            registerAs(world.me(), VIN);
            world.put(OWNED_KEY, true);
        }
    }

    private void registerAs(UUID user, String vin) {
        register.register(new RegisterVehicleCommand(user, vin, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private static byte[] pdf(String name) {
        return ("%PDF-1.4\n% " + name + "\n").getBytes(StandardCharsets.US_ASCII);
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
