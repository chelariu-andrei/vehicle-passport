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
import com.vehiclepassport.server.event.application.port.in.CurrencyAmountView;
import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineSummaryUseCase;
import com.vehiclepassport.server.event.application.port.in.TimelineSummaryView;
import com.vehiclepassport.server.event.application.port.in.TypeCountView;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.TimelineFilterView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.in.TimelineQuery;
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
import com.vehiclepassport.server.testsupport.fake.TestClock;
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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private static final String NAMED_KEY = "extended.named";
    private static final String FILTERED_KEY = "extended.filtered";
    private static final String CURSOR_KEY = "extended.cursor";
    private static final String SUMMARY_KEY = "extended.summary";
    private static final String TIMELINE_KEY = "event.timeline"; // written by EventSteps "I request the timeline"
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
    @Inject
    DeleteEventUseCase deleteEvent;
    @Inject
    TestClock clock;
    @Inject
    GetTimelineSummaryUseCase summaries;

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
        List<EventView> items = all();
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

    // ---- filters and order ----

    @Given("V has a SERVICE tagged ENGINE in 2024, a REPAIR tagged BRAKES in 2025 and an INSURANCE RCA in 2025")
    public void vHasTaggedEvents() {
        Map<String, UUID> named = new HashMap<>();
        named.put("SERVICE", addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("SERVICE",
                LocalDate.parse("2024-06-01"), 100000, BigDecimal.TEN, "RON", null, null, null, null, null,
                List.of("ENGINE"), null))).id());
        named.put("REPAIR", addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("REPAIR",
                LocalDate.parse("2025-03-01"), 110000, BigDecimal.TEN, "RON", null, null, null, null, null,
                List.of("BRAKES"), null))).id());
        LocalDate rca = LocalDate.parse("2025-05-01");
        named.put("RCA", addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("INSURANCE", rca, null,
                new BigDecimal("1200"), "RON", null, null, rca, rca.plusYears(1).minusDays(1),
                insurance("RCA", "Allianz"), null, null))).id());
        world.put(NAMED_KEY, named);
    }

    /** {@code query} is a URL-style query string: type, component, from, to, order (repeatable lists). */
    @When("I request the timeline with {word}")
    public void iRequestTheTimelineWith(String query) {
        Query parsed = Query.parse(query);
        TimelineQuery q = new TimelineQuery(world.me(), VIN, parsed.filter(), parsed.order(), null, 100);
        world.attempt(() -> world.put(FILTERED_KEY, timeline.get(q).items()));
    }

    /** A URL-style query string: type, component, from, to, order (repeatable lists). */
    private record Query(TimelineFilterView filter, String order) {

        static Query parse(String query) {
            List<String> types = new ArrayList<>();
            List<String> components = new ArrayList<>();
            LocalDate from = null;
            LocalDate to = null;
            String order = null;
            for (String pair : query.split("&")) {
                String[] kv = pair.split("=", 2);
                switch (kv[0]) {
                    case "type" -> types.add(kv[1]);
                    case "component" -> components.add(kv[1]);
                    case "from" -> from = LocalDate.parse(kv[1]);
                    case "to" -> to = LocalDate.parse(kv[1]);
                    case "order" -> order = kv[1];
                    default -> throw new IllegalArgumentException("Unknown query parameter " + kv[0]);
                }
            }
            return new Query(new TimelineFilterView(types, components, from, to), order);
        }
    }

    /** Narrow on purpose: "I see the same public URL ..." and "I see all N events ..." belong to other steps. */
    @Then("^I see (nothing|the (?:SERVICE|REPAIR|RCA)(?: and the (?:SERVICE|REPAIR|RCA))*)$")
    public void iSee(String result) {
        assertNoError();
        Map<String, UUID> named = world.get(NAMED_KEY);
        List<UUID> expected = result.equals("nothing") ? List.of()
                : Arrays.stream(result.split(" and ")).map(n -> named.get(n.replaceFirst("^the ", ""))).toList();
        List<EventView> items = world.get(FILTERED_KEY);
        assertEquals(expected, items.stream().map(EventView::id).toList());
    }

    @Given("V has {int} events on {word} recorded at the same moment")
    public void vHasEventsAtTheSameMoment(int count, String date) {
        for (int i = 0; i < count; i++) {
            addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.parse(date), 100000)));
        }
    }

    @When("I read the timeline {int} at a time with order={word}")
    public void iReadTheTimelineWithOrder(int size, String order) {
        List<EventView> seen = new ArrayList<>();
        String cursor = null;
        int guard = 0;
        do {
            TimelinePage page = timeline.get(new TimelineQuery(world.me(), VIN, null, order, cursor, size));
            assertTrue(page.items().size() <= size);
            seen.addAll(page.items());
            cursor = page.nextCursor();
            assertTrue(++guard < 50, "pagination does not terminate");
        } while (cursor != null);
        world.put(FILTERED_KEY, seen);
    }

    @Then("I see all {int} events exactly once, newest first")
    public void iSeeAllEventsNewestFirst(int count) {
        List<UUID> ids = this.<List<EventView>>fromWorld(FILTERED_KEY).stream().map(EventView::id).toList();
        assertEquals(count, new HashSet<>(ids).size(), "no repeats");
        List<UUID> ascending = new ArrayList<>(all().stream().map(EventView::id).toList());
        Collections.reverse(ascending);
        assertEquals(ascending, ids, "exactly the ascending timeline reversed");
        List<EventView> items = world.get(FILTERED_KEY);
        for (int i = 1; i < items.size(); i++) {
            assertTrue(!items.get(i).date().isAfter(items.get(i - 1).date()), "dates never increase");
        }
    }

    @Given("I hold a cursor from an ascending page")
    public void iHoldAnAscendingCursor() {
        for (int i = 1; i <= 3; i++) {
            addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(2025, i, 1), 100000 + i)));
        }
        String cursor = timeline.get(new TimelineQuery(world.me(), VIN, null, "asc", null, 1)).nextCursor();
        assertNotNull(cursor);
        world.put(CURSOR_KEY, cursor);
    }

    @When("I use it with order={word}")
    public void iUseItWithOrder(String order) {
        world.attempt(() -> timeline.get(new TimelineQuery(world.me(), VIN, null, order, world.get(CURSOR_KEY),
                1)));
    }

    // ---- validity status ----

    @Given("today is {word}")
    public void todayIs(String date) {
        clock.set(LocalDate.parse(date).atTime(10, 0).toInstant(ZoneOffset.UTC));
    }

    @Given("V has an RCA valid {word} to {word} and an RCA valid {word} to {word}")
    public void vHasTwoRcas(String from1, String until1, String from2, String until2) {
        name("older", insured("RCA", from1, until1));
        name("newer", insured("RCA", from2, until2));
    }

    @Given("V has a current RCA and an older CASCO that expired")
    public void vHasACurrentRcaAndAnExpiredCasco() {
        name("CASCO", insured("CASCO", "2025-01-01", "2025-12-31"));
        name("RCA", insured("RCA", "2026-11-01", "2027-10-31"));
    }

    @Given("V has an RCA from 2024 and a newer RCA from 2026")
    public void vHasAnRcaFrom2024And2026() {
        name("2024", insured("RCA", "2024-03-01", "2025-02-28"));
        name("2026", insured("RCA", "2026-03-01", "2027-02-28"));
    }

    @Given("V has a FIRST_AID_KIT valid until {word} and a FIRE_EXTINGUISHER that expired on {word}")
    public void vHasAKitAndAnExpiredExtinguisher(String kitUntil, String extinguisherUntil) {
        name("extinguisher", equipment("FIRE_EXTINGUISHER", "2025-01-01", extinguisherUntil));
        name("first-aid kit", equipment("FIRST_AID_KIT", "2026-05-01", kitUntil));
    }

    @Given("V has a FIRE_EXTINGUISHER valid until {word}")
    public void vHasAnExtinguisher(String until) {
        name("older one", equipment("FIRE_EXTINGUISHER", "2025-01-01", until));
    }

    @When("I add a FIRE_EXTINGUISHER valid until {word}")
    public void iAddAnExtinguisher(String until) {
        add(new EventInput("SAFETY_EQUIPMENT", LocalDate.parse("2026-11-01"), null, new BigDecimal("90"), "RON",
                null, null, null, LocalDate.parse(until),
                kind("SAFETY_EQUIPMENT", null, null, null, null, null, null, "FIRE_EXTINGUISHER"), null, null));
    }

    @When("I delete the newer RCA")
    public void iDeleteTheNewerRca() {
        deleteEvent.delete(world.me(), VIN, named("newer"));
    }

    @When("I change the older RCA's insurer")
    public void iChangeTheOlderRcasInsurer() {
        EventView v = find(named("older"));
        world.attempt(() -> world.put(RESULT_KEY, updateEvent.update(new UpdateEventCommand(world.me(), VIN, v.id(),
                inputOf(v, v.costAmount(), v.type(), v.validFrom(), v.validUntil(), insurance("RCA", "Groupama"),
                        v.components(), v.customFields())))));
    }

    @When("I confirm a scan as ITP without validUntil")
    public void iConfirmAnItpScanWithoutValidUntil() {
        confirmScan("ITP", "RAR Iasi", 120000, null, "PASSED");
    }

    @Then("the {word} RCA has validityStatus {word}")
    public void theRcaHasValidityStatus(String name, String status) {
        assertEquals(status, seen(named(name)).validityStatus());
    }

    @Then("^the (RCA|CASCO|first-aid kit|extinguisher) is (VALID|EXPIRING|EXPIRED|SUPERSEDED|UNKNOWN)$")
    public void theEntryIs(String name, String status) {
        assertEquals(status, seen(named(name)).validityStatus());
    }

    @Then("the RCA is VALID or EXPIRING")
    public void theRcaIsLive() {
        String status = seen(named("RCA")).validityStatus();
        assertTrue("VALID".equals(status) || "EXPIRING".equals(status), status);
    }

    @Then("the older one has validityStatus {word} and stays in the timeline")
    public void theOlderOneHasValidityStatus(String status) {
        assertNoError();
        assertEquals(status, find(named("older one")).validityStatus());
    }

    @Then("the new one has validityStatus {word}")
    public void theNewOneHasValidityStatus(String status) {
        EventView added = added();
        assertEquals(status, added.validityStatus(), "the add response carries the status");
        assertEquals(status, find(added.id()).validityStatus());
    }

    @Then("the changed RCA comes back with validityStatus {word}")
    public void theChangedRcaComesBackWith(String status) {
        EventView changed = added();
        assertEquals("Groupama", changed.details().insurer());
        assertEquals(status, changed.validityStatus(), "the update response carries the status");
    }

    @Then("the ITP has validityStatus {word}")
    public void theItpHasValidityStatus(String status) {
        assertNoError();
        EventView itp = seen(world.get(RESULT_KEY));
        assertEquals("ITP", itp.type());
        assertNull(itp.validUntil());
        assertEquals(status, itp.validityStatus());
    }

    // ---- summary ----

    @Given("V has events costing {int} {word}, {int} {word} and {int} {word}")
    public void vHasEventsCosting(int a1, String c1, int a2, String c2, int a3, String c3) {
        LocalDate day = LocalDate.parse("2025-03-01");
        costing(day, 1000, a1, c1);
        costing(day, 1001, a2, c2);
        costing(day, 1002, a3, c3);
    }

    @Given("V has readings {int} km on {word}, {int} km on {word} and {int} km on {word}")
    public void vHasReadings(int km1, String d1, int km2, String d2, int km3, String d3) {
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.parse(d1), km1)));
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.parse(d2), km2)));
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.parse(d3), km3)));
    }

    @Given("V has a SERVICE at {int} km and a REPAIR at {int} km in {int}")
    public void vHasAServiceAndARepair(int serviceKm, int repairKm, int year) {
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(year, 3, 1), serviceKm)));
        addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("REPAIR", LocalDate.of(year, 9, 1),
                repairKm, BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        // An insurance without km in the period changes nothing about the distance.
        LocalDate rca = LocalDate.of(year, 10, 1);
        addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("INSURANCE", rca, null,
                new BigDecimal("1200"), "RON", null, null, rca, rca.plusYears(1).minusDays(1),
                insurance("RCA", "Allianz"), null, null)));
    }

    @Given("V has one reading in {int}")
    public void vHasOneReadingIn(int year) {
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(year, 5, 1), 80000)));
        // A later reading, outside the period, is no second reading for it.
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(year + 1, 1, 5), 85000)));
    }

    @Given("V has events in {int} and {int}")
    public void vHasEventsIn(int y1, int y2) {
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(y1, 4, 1), 50000)));
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(y2, 4, 1), 70000)));
        addEvent.add(new AddEventCommand(world.me(), VIN, service(LocalDate.of(y2, 8, 1), 75000)));
    }

    @When("I request the summary")
    public void iRequestTheSummary() {
        summarise(null);
    }

    @When("I request the summary with {word}")
    public void iRequestTheSummaryWith(String query) {
        summarise(Query.parse(query).filter());
    }

    @When("I request the summary for {int}")
    public void iRequestTheSummaryFor(int year) {
        summarise(year(year, List.of()));
    }

    @When("I request the summary for {int} with no earlier readings")
    public void iRequestTheSummaryForWithNoEarlierReadings(int year) {
        summarise(year(year, List.of()));
    }

    @When("I request the summary for {int} with {word}")
    public void iRequestTheSummaryForWith(int year, String query) {
        summarise(year(year, Query.parse(query).filter().types()));
    }

    @Then("costByCurrency is {int} {word} and {int} {word}")
    public void costByCurrencyIs(int a1, String c1, int a2, String c2) {
        assertEquals(List.of(new CurrencyAmountView(c1, new BigDecimal(a1).setScale(2)),
                new CurrencyAmountView(c2, new BigDecimal(a2).setScale(2))), summary().costByCurrency());
        assertEquals(3, summary().eventCount());
    }

    @Then("distance is {int} km from {int} to {int}")
    public void distanceIsFromTo(int km, int from, int to) {
        TimelineSummaryView s = summary();
        assertEquals(km, s.distanceKm());
        assertEquals(from, s.fromKm());
        assertEquals(to, s.toKm());
    }

    @Then("distance is {int} km")
    public void distanceIs(int km) {
        assertEquals(km, summary().distanceKm());
    }

    @Then("distance km is empty")
    public void distanceKmIsEmpty() {
        TimelineSummaryView s = summary();
        assertNull(s.distanceKm());
        assertNull(s.fromKm(), "the only reading cannot be both ends");
        assertEquals(80000, s.toKm());
    }

    @Then("years are {int} and {int}")
    public void yearsAre(int y1, int y2) {
        assertEquals(List.of(y1, y2), summary().years());
    }

    @Then("the summary counts {int} {word}")
    public void theSummaryCounts(int count, String type) {
        TimelineSummaryView s = summary();
        assertEquals(count, s.eventCount());
        assertEquals(List.of(new TypeCountView(type, count)), s.countsByType());
    }

    @Then("the summary counts no events")
    public void theSummaryCountsNoEvents() {
        TimelineSummaryView s = summary();
        assertEquals(0, s.eventCount());
        assertEquals(List.of(), s.countsByType());
        assertEquals(List.of(), s.costByCurrency());
    }

    private void costing(LocalDate date, int km, int amount, String currency) {
        addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("SERVICE", date, km,
                BigDecimal.valueOf(amount), currency, null, null, null, null, null, null, null)));
    }

    private static TimelineFilterView year(int year, List<String> types) {
        return new TimelineFilterView(types, List.of(), LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    private void summarise(TimelineFilterView filter) {
        world.attempt(() -> world.put(SUMMARY_KEY, summaries.summary(world.me(), VIN, filter)));
    }

    private TimelineSummaryView summary() {
        assertNoError();
        return fromWorld(SUMMARY_KEY);
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

    /** An INSURANCE event dated on its first valid day. */
    private UUID insured(String coverage, String from, String until) {
        LocalDate start = LocalDate.parse(from);
        return addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("INSURANCE", start, null,
                new BigDecimal("1200"), "RON", null, null, start, LocalDate.parse(until),
                insurance(coverage, "Allianz"), null, null))).id();
    }

    private UUID equipment(String item, String date, String until) {
        return addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("SAFETY_EQUIPMENT",
                LocalDate.parse(date), null, new BigDecimal("90"), "RON", null, null, null, LocalDate.parse(until),
                kind("SAFETY_EQUIPMENT", null, null, null, null, null, null, item), null, null))).id();
    }

    private void name(String name, UUID id) {
        Map<String, UUID> named = world.get(NAMED_KEY);
        if (named == null) {
            named = new HashMap<>();
            world.put(NAMED_KEY, named);
        }
        named.put(name, id);
    }

    private UUID named(String name) {
        Map<String, UUID> named = fromWorld(NAMED_KEY);
        return Objects.requireNonNull(named.get(name), name);
    }

    /**
     * The event as the last timeline read returned it: the filtered page when one was read, else the plain
     * timeline ("I request the timeline", from EventSteps). Fails when the event is not on that page.
     */
    private EventView seen(UUID id) {
        assertNoError();
        List<EventView> items = world.get(FILTERED_KEY);
        if (items == null) {
            items = fromWorld(TIMELINE_KEY);
        }
        return items.stream().filter(e -> e.id().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError(id + " is not on the page read"));
    }

    private EventView find(UUID id) {
        return all().stream().filter(e -> e.id().equals(id)).findFirst().orElseThrow();
    }

    private List<EventView> all() {
        return timeline.get(TimelineQuery.firstPage(world.me(), VIN, 100)).items();
    }

    private <T> T fromWorld(String key) {
        T value = world.get(key);
        assertNotNull(value, key);
        return value;
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
