package com.vehiclepassport.server.event.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.AttachmentUpload;
import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanCommand;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.PartInput;
import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakeScanJobRepository;
import io.cucumber.java.en.But;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

/** Extended timeline (spec §10.3): new types, validity, typed details, components and custom fields. */
@ApplicationScoped
public class TimelineExtendedSteps {

    private static final String VIN = "WVWZZZ1JZXW000001"; // V, shared with EventSteps
    private static final String JOB_KEY = "scan.job"; // shared with ReviewSteps ("the job is still EXTRACTED")
    private static final String RESULT_KEY = "extended.result";
    private static final String EVENT_KEY = "extended.event";
    private static final String ATTEMPTS_KEY = "extended.attempts";
    private static final LocalDate DATE = LocalDate.parse("2026-01-10");
    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01};

    @Inject
    World world;
    @Inject
    AddEventUseCase addEvent;
    @Inject
    UpdateEventUseCase updateEvent;
    @Inject
    GetTimelineUseCase timeline;
    @Inject
    SaveConfirmedEventUseCase saveConfirmed;
    @Inject
    AddAttachmentUseCase attachments;
    @Inject
    SubmitScanUseCase submit;
    @Inject
    ProcessScanJobsUseCase worker;
    @Inject
    ConfirmScanUseCase confirm;
    @Inject
    FakeScanJobRepository jobs;

    // ---- adding ----

    @When("I add a SERVICE event with only the original fields: {word}, {int} km, {int} RON")
    public void iAddALegacyEvent(String date, int km, int cost) {
        add(new EventInput("SERVICE", LocalDate.parse(date), km, BigDecimal.valueOf(cost), "RON", null, null, null,
                null, null, null, null));
    }

    @When("I add an INSURANCE event without details")
    public void iAddAnInsuranceWithoutDetails() {
        add(input("INSURANCE", null, null, DATE, DATE.plusYears(1).minusDays(1), null, null));
    }

    @When("I add an INSURANCE event with coverage {word}, insurer {string}, valid {word} to {word}")
    public void iAddAnInsurance(String coverage, String insurer, String from, String until) {
        add(input("INSURANCE", null, null, LocalDate.parse(from), LocalDate.parse(until),
                insurance(coverage, insurer), null));
    }

    @When("I add a ROVINIETA event valid from {word} for {word}")
    public void iAddARovinieta(String from, String duration) {
        add(new EventInput("ROVINIETA", LocalDate.parse(from), null, new BigDecimal("28"), "EUR", null, null,
                LocalDate.parse(from), null, kind("ROVINIETA", null, null, null, duration, null, null, null), null,
                null));
    }

    @When("I add a ROVINIETA event with a validUntil")
    public void iAddARovinietaWithValidUntil() {
        add(input("ROVINIETA", null, null, DATE, DATE.plusDays(6),
                kind("ROVINIETA", null, null, null, "SEVEN_DAYS", null, null, null), null));
    }

    @When("I add an OTHER event without customLabel")
    public void iAddAnOtherWithoutLabel() {
        add(input("OTHER", null, null, null, null, null, null));
    }

    @When("I add a SAFETY_EQUIPMENT event for {word} without validUntil")
    public void iAddSafetyEquipmentWithoutValidUntil(String item) {
        add(input("SAFETY_EQUIPMENT", null, null, null, null,
                kind("SAFETY_EQUIPMENT", null, null, null, null, null, null, item), null));
    }

    @When("I add an OTHER event {string} with custom fields {string}={string} and {string}={string}")
    public void iAddAnOtherWithCustomFields(String label, String l1, String v1, String l2, String v2) {
        add(input("OTHER", null, label, null, null, null,
                List.of(new CustomFieldView(l1, v1), new CustomFieldView(l2, v2))));
    }

    @When("I add an event with {int} custom fields")
    public void iAddAnEventWithCustomFields(int count) {
        add(input("OTHER", null, "Detailing", null, null, null,
                IntStream.rangeClosed(1, count).mapToObj(i -> new CustomFieldView("L" + i, "v" + i)).toList()));
    }

    @When("I add a SERVICE event tagged {string}")
    public void iAddAServiceTagged(String component) {
        add(new EventInput("SERVICE", DATE, 1000, BigDecimal.TEN, "RON", null, null, null, null, null,
                List.of(component), null));
    }

    @When("I add a SERVICE event dated in the future")
    public void iAddAServiceInTheFuture() {
        add(new EventInput("SERVICE", LocalDate.parse("2026-02-01"), 1000, BigDecimal.TEN, "RON", null, null, null,
                null, null, null, null));
    }

    // ---- odometer ----

    @Given("V has a SERVICE at {word} with {int} km")
    public void vHasAServiceAt(String date, int km) {
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.parse(date), km)));
    }

    @When("I add an INSURANCE event on {word} without kilometres")
    public void iAddAnInsuranceWithoutKm(String date) {
        LocalDate d = LocalDate.parse(date);
        attempt(new EventInput("INSURANCE", d, null, new BigDecimal("1200"), "RON", null, null, d,
                d.plusYears(1).minusDays(1), insurance("RCA", "Allianz"), null, null));
    }

    @When("I add a SERVICE at {word} with {int} km")
    public void iAddAServiceAt(String date, int km) {
        attempt(service(LocalDate.parse(date), km));
    }

    @Then("both are accepted")
    public void bothAreAccepted() {
        List<RuntimeException> errors = world.get(ATTEMPTS_KEY);
        assertEquals(2, errors.size());
        errors.forEach(e -> assertNull(e, String.valueOf(e)));
        List<EventView> items = timeline.get(world.me(), VIN, null, 100).items();
        assertEquals(3, items.size());
        assertNull(items.get(1).odometerKm(), "the insurance has no km");
    }

    // ---- scan confirm ----

    @When("I confirm a scan as ITP with serviceName {string}, odometer {int} km, validUntil {word} and result {word}")
    public void iConfirmAScanAsItp(String serviceName, int km, String until, String result) {
        confirmScan("ITP", serviceName, km, LocalDate.parse(until), result);
    }

    @When("I confirm a scan as SERVICE with a validUntil")
    public void iConfirmAServiceScanWithValidUntil() {
        confirmScan("SERVICE", "Auto Service SRL", 120000, LocalDate.parse("2027-01-01"), null);
    }

    @When("I confirm a scan as ITP with a {int}-character serviceName")
    public void iConfirmAnItpScanWithALongStation(int length) {
        confirmScan("ITP", "S".repeat(length), 120000, null, null);
    }

    @Then("the event has evidence DOCUMENTED, details kind ITP with station {string} and validUntil {word}")
    public void theScannedItpEvent(String station, String until) {
        assertNoError();
        EventView e = find(world.get(RESULT_KEY));
        assertEquals("DOCUMENTED", e.evidence());
        assertEquals("SCAN", e.source());
        assertEquals("ITP", e.type());
        assertEquals(120000, e.odometerKm());
        assertNotNull(e.details());
        assertEquals("ITP", e.details().kind());
        assertEquals(station, e.details().station());
        assertEquals("PASSED", e.details().result());
        assertNull(e.details().parts(), "a scanned ITP drops the parts");
        assertEquals(LocalDate.parse(until), e.validUntil());
        assertEquals(e.date(), e.validFrom());
    }

    // ---- attachments ----

    @Given("V has a manual ITP event")
    public void vHasAManualItpEvent() {
        EventView v = addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("ITP", DATE, 90000,
                new BigDecimal("150"), "RON", null, null, null, LocalDate.parse("2028-01-10"), null, null, null)));
        world.put(EVENT_KEY, v.id());
    }

    @When("I attach a PDF report to it")
    public void iAttachAPdfReport() {
        byte[] pdf = "%PDF-1.4\n% ITP report\n".getBytes(StandardCharsets.US_ASCII);
        world.attempt(() -> attachments.add(world.me(), VIN, world.get(EVENT_KEY),
                new AttachmentUpload(new ByteArrayInputStream(pdf), "application/pdf", pdf.length)));
    }

    @Then("its evidence is still USER_CONFIRMED")
    public void itsEvidenceIsStillUserConfirmed() {
        assertNoError();
        EventView e = find(world.get(EVENT_KEY));
        assertEquals("USER_CONFIRMED", e.evidence());
        assertEquals(1, e.attachmentCount());
        assertEquals(LocalDate.parse("2028-01-10"), e.validUntil());
    }

    // ---- editing ----

    @Given("V has a DOCUMENTED event")
    public void vHasADocumentedEvent() {
        UUID id = saveConfirmed.save(new SaveConfirmedEventCommand(world.me(), VIN, "SERVICE",
                LocalDate.parse("2025-03-01"), 120000, new BigDecimal("450.00"), "RON", "scan",
                DetailsView.scan("Auto Service SRL", List.of(), new BigDecimal("100")), "docs/key.pdf",
                "application/pdf", null, 0, null, null));
        world.put(EVENT_KEY, id);
    }

    @Given("V has an INSURANCE RCA event")
    public void vHasAnInsuranceRcaEvent() {
        EventView v = addEvent.add(new AddEventCommand(world.me(), VIN, input("INSURANCE", null, null, DATE,
                DATE.plusYears(1).minusDays(1), insurance("RCA", "Allianz"), null)));
        world.put(EVENT_KEY, v.id());
    }

    @When("I change its components to BRAKES and add a custom field")
    public void iChangeItsComponents() {
        EventView v = find(world.get(EVENT_KEY));
        update(v, inputOf(v, v.costAmount(), v.type(), v.validFrom(), v.validUntil(), null, List.of("BRAKES"),
                List.of(new CustomFieldView("Mechanic", "Ion"))));
    }

    @Then("the change is saved")
    public void theChangeIsSaved() {
        assertNoError();
        EventView e = find(world.get(EVENT_KEY));
        assertEquals(List.of("BRAKES"), e.components());
        assertEquals(List.of(new CustomFieldView("Mechanic", "Ion")), e.customFields());
        assertEquals("DOCUMENTED", e.evidence());
        assertEquals("SCAN", e.details().kind(), "the scan details are kept");
        assertEquals("Auto Service SRL", e.details().serviceName());
    }

    @But("changing its cost is refused with {int} {string}")
    public void changingItsCostIsRefused(int status, String code) {
        EventView v = find(world.get(EVENT_KEY));
        update(v, inputOf(v, v.costAmount().add(BigDecimal.ONE), v.type(), v.validFrom(), v.validUntil(), null,
                v.components(), v.customFields()));
        theAnswerIs(status, code);
    }

    @When("I change it to a SERVICE that still carries the insurance details")
    public void iChangeItToAServiceWithInsuranceDetails() {
        EventView v = find(world.get(EVENT_KEY));
        update(v, inputOf(v, v.costAmount(), "SERVICE", null, null, v.details(), List.of(), List.of()));
    }

    @When("I change it to a SERVICE that still carries the validity")
    public void iChangeItToAServiceWithValidity() {
        EventView v = find(world.get(EVENT_KEY));
        update(v, inputOf(v, v.costAmount(), "SERVICE", v.validFrom(), v.validUntil(), null, List.of(),
                List.of()));
    }

    // ---- outcomes ----

    @Then("the answer is {int} {string}")
    public void theAnswerIs(int status, String code) {
        RuntimeException error = world.lastError();
        assertNotNull(error, "expected a refusal with " + code);
        DomainException d = assertInstanceOf(DomainException.class, error, String.valueOf(error));
        assertEquals(code, d.code(), d.getMessage());
        assertEquals(status, d.kind().status(), d.getMessage());
    }

    @Then("the event is saved with no components, no custom fields and no validity")
    public void theLegacyEventIsSaved() {
        EventView e = added();
        assertEquals(1000, e.odometerKm());
        assertEquals(List.of(), e.components());
        assertEquals(List.of(), e.customFields());
        assertNull(e.validFrom());
        assertNull(e.validUntil());
        assertNull(e.validityStatus());
        assertNull(e.customLabel());
        assertNull(e.details());
        assertEquals("USER_CONFIRMED", e.evidence());
    }

    @Then("the event shows coverage {word} and validUntil {word}")
    public void theEventShowsCoverage(String coverage, String until) {
        EventView e = find(added().id());
        assertEquals("INSURANCE", e.details().kind());
        assertEquals(coverage, e.details().coverage());
        assertEquals("Allianz", e.details().insurer());
        assertEquals(LocalDate.parse(until), e.validUntil());
    }

    @Then("its odometer is empty")
    public void itsOdometerIsEmpty() {
        assertNull(find(added().id()).odometerKm());
    }

    @Then("validUntil is the date the official rule gives for that start")
    public void validUntilIsTheOfficialDate() {
        EventView e = find(added().id());
        // Twelve months from 2026-01-15 end on 2027-01-14, the last valid day included.
        assertEquals(LocalDate.parse("2026-01-15"), e.validFrom());
        assertEquals(LocalDate.parse("2027-01-14"), e.validUntil());
        assertEquals("TWELVE_MONTHS", e.details().duration());
    }

    @Then("the event shows those custom fields in that order")
    public void theEventShowsTheCustomFieldsInOrder() {
        EventView e = find(added().id());
        assertEquals("Ceramic coating", e.customLabel());
        assertEquals(List.of(new CustomFieldView("Layers", "3"), new CustomFieldView("Warranty", "5 years")),
                e.customFields());
    }

    // ---- helpers ----

    private void add(EventInput input) {
        world.attempt(() -> world.put(RESULT_KEY, addEvent.add(new AddEventCommand(world.me(), VIN, input))));
    }

    /** Keeps every outcome, for steps that check several adds at once. */
    private void attempt(EventInput input) {
        add(input);
        List<RuntimeException> errors = world.get(ATTEMPTS_KEY);
        if (errors == null) {
            errors = new ArrayList<>();
            world.put(ATTEMPTS_KEY, errors);
        }
        errors.add(world.lastError());
    }

    private void update(EventView v, EventInput input) {
        world.attempt(() -> updateEvent.update(new UpdateEventCommand(world.me(), VIN, v.id(), input)));
    }

    private EventView added() {
        assertNoError();
        EventView e = world.get(RESULT_KEY);
        assertNotNull(e);
        return e;
    }

    private static EventInput input(String type, Integer km, String label, LocalDate from, LocalDate until,
            DetailsView details, List<CustomFieldView> fields) {
        return new EventInput(type, DATE, km, new BigDecimal("100"), "RON", null, label, from, until, details, null,
                fields);
    }

    private static EventInput service(LocalDate date, int km) {
        return new EventInput("SERVICE", date, km, BigDecimal.TEN, "RON", null, null, null, null, null, null, null);
    }

    /** The request a client would send for {@code v}, with the given changes. */
    private static EventInput inputOf(EventView v, BigDecimal cost, String type, LocalDate from, LocalDate until,
            DetailsView details, List<String> components, List<CustomFieldView> fields) {
        return new EventInput(type, v.date(), v.odometerKm(), cost, v.currency(), v.notes(), v.customLabel(), from,
                until, details, components, fields);
    }

    private static DetailsView insurance(String coverage, String insurer) {
        return kind("INSURANCE", coverage, insurer, null, null, null, null, null);
    }

    private static DetailsView kind(String kind, String coverage, String insurer, String policyNumber,
            String duration, String station, String result, String item) {
        return new DetailsView(kind, null, null, null, coverage, insurer, policyNumber, duration, station, result,
                item);
    }

    private void confirmScan(String type, String serviceName, int km, LocalDate validUntil, String result) {
        ScanJobView job = submit.submit(world.me(), VIN, png());
        worker.processPending();
        world.put(JOB_KEY, job);
        ScanResult r = jobs.findById(job.id()).orElseThrow().result();
        List<PartInput> parts = r.parts().value().stream()
                .map(p -> new PartInput(p.name(), p.qty(), p.price())).toList();
        world.attempt(() -> world.put(RESULT_KEY, confirm.confirm(new ConfirmScanCommand(world.me(), job.id(),
                type, r.date().value(), km, serviceName, parts, r.labor().value(), r.total().value(), null, null,
                validUntil, result))));
    }

    private EventView find(UUID id) {
        return timeline.get(world.me(), VIN, null, 100).items().stream()
                .filter(e -> e.id().equals(id)).findFirst().orElseThrow();
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        assertTrue(error == null, "unexpected failure: " + error);
    }

    private static UploadedFile png() {
        try {
            Path path = Files.createTempFile("scan-test", ".bin");
            path.toFile().deleteOnExit();
            Files.write(path, PNG_BYTES);
            return new UploadedFile(path, "image/png", PNG_BYTES.length);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
