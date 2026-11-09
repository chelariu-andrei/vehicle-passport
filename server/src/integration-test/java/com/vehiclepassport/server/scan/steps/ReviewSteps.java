package com.vehiclepassport.server.scan.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanCommand;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.PartInput;
import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import com.vehiclepassport.server.scan.application.port.in.RejectScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanBatchView;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanBatchUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakeEventRepository;
import com.vehiclepassport.server.testsupport.fake.FakeReceiptExtraction;
import com.vehiclepassport.server.testsupport.fake.FakeScanJobRepository;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ReviewSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String JOB_KEY = "scan.job"; // shared with ScanSteps
    private static final String OWNED_KEY = "event.owned"; // shared with EventSteps
    private static final String OWNER_KEY = "review.owner";
    private static final String EVENT_KEY = "review.eventId";
    private static final String BATCH_JOBS_KEY = "review.batchJobs";
    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01};

    @Inject
    World world;

    @Inject
    SubmitScanUseCase submit;

    @Inject
    SubmitScanBatchUseCase submitBatch;

    @Inject
    ProcessScanJobsUseCase worker;

    @Inject
    ConfirmScanUseCase confirm;

    @Inject
    RejectScanUseCase reject;

    @Inject
    GetTimelineUseCase timeline;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ReleaseVehicleUseCase release;

    @Inject
    FakeScanJobRepository jobs;

    @Inject
    FakeEventRepository events;

    @Inject
    FakeReceiptExtraction extraction;

    @Given("an extracted result")
    public void anExtractedResult() {
        extractJob();
    }

    @Given("an extracted result with km {int}")
    public void anExtractedResultWithKm(int km) {
        extraction.willReturn(withDateAndKm(null, km));
        extractJob();
    }

    @Given("an extracted result dated {word} with km {int}")
    public void anExtractedResultDated(String date, int km) {
        extraction.willReturn(withDateAndKm(LocalDate.parse(date), km));
        extractJob();
    }

    @Given("an extracted result with parts, labor and service name")
    public void anExtractedResultWithDetails() {
        extractJob();
    }

    @Given("a job I already confirmed")
    public void aJobIAlreadyConfirmed() {
        extractJob();
        confirmAs(null);
    }

    @Given("a batch of {int} extracted jobs for V")
    public void aBatchOfExtractedJobs(int count) {
        ownAsMe();
        List<UploadedFile> files = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            files.add(png());
        }
        ScanBatchView batch = submitBatch.submit(world.me(), VIN, files);
        worker.processPending();
        world.put(BATCH_JOBS_KEY, batch.jobs().stream().map(ScanJobView::id).toList());
    }

    @Given("ownership of V moved to Alice")
    public void ownershipMovedToAlice() {
        release.release(VIN, world.me());
        UUID alice = world.user("Alice");
        register.register(new RegisterVehicleCommand(alice, VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
        world.put(OWNER_KEY, alice);
    }

    @Given("I own V again")
    public void iOwnVAgain() {
        register.register(new RegisterVehicleCommand(world.me(), VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    @When("I confirm the extracted data")
    public void iConfirmTheExtractedData() {
        world.attempt(() -> confirmAs(null));
    }

    @When("I confirm with corrected km {int}")
    public void iConfirmWithCorrectedKm(int km) {
        world.attempt(() -> confirmAs(km));
    }

    @When("I confirm without choosing type or currency")
    public void iConfirmWithoutTypeOrCurrency() {
        world.attempt(() -> confirmAs(null));
    }

    @When("I reject it")
    public void iRejectIt() {
        ScanJobView view = world.get(JOB_KEY);
        world.attempt(() -> reject.reject(world.me(), view.id()));
    }

    @When("I confirm the second and then reject the first")
    public void iConfirmTheSecondThenRejectTheFirst() {
        List<UUID> ids = world.get(BATCH_JOBS_KEY);
        world.attempt(() -> {
            world.put(EVENT_KEY, confirm.confirm(command(ids.get(1), null)));
            reject.reject(world.me(), ids.get(0));
        });
    }

    @Then("an event with evidence DOCUMENTED is added to V")
    public void anEventWithEvidenceDocumentedIsAdded() {
        assertNoError();
        assertEquals("DOCUMENTED", savedEvent().evidence());
    }

    @Then("the original file is attached to the event")
    public void theOriginalFileIsAttached() {
        assertTrue(savedEvent().documentPresent());
    }

    @Then("the event stores km {int}")
    public void theEventStoresKm(int km) {
        assertNoError();
        assertEquals(km, savedEvent().odometerKm());
    }

    @Then("the event has type SERVICE and currency RON")
    public void theEventHasDefaults() {
        assertNoError();
        EventView event = savedEvent();
        assertEquals("SERVICE", event.type());
        assertEquals("RON", event.currency());
    }

    @Then("the event details hold the service name, parts and labor")
    public void theEventDetailsHold() {
        assertNoError();
        EventView event = savedEvent();
        assertNotNull(event.details());
        assertEquals("Auto Service SRL", event.details().serviceName());
        assertEquals(1, event.details().parts().size());
        assertEquals("Oil filter", event.details().parts().get(0).name());
        assertEquals(0, event.details().labor().compareTo(new BigDecimal("100")));
    }

    @Then("the job is still EXTRACTED")
    public void theJobIsStillExtracted() {
        assertEquals(ScanStatus.EXTRACTED, stored().status());
    }

    @Then("the stored job is {word}")
    public void theStoredJobIs(String status) {
        assertEquals(ScanStatus.valueOf(status), stored().status());
    }

    @Then("V has exactly one event from that job")
    public void vHasExactlyOneEvent() {
        assertEquals(1, events.allActive(VIN).size());
    }

    @Then("the job is REJECTED and no event exists")
    public void theJobIsRejectedAndNoEvent() {
        assertNoError();
        assertEquals(ScanStatus.REJECTED, stored().status());
        assertEquals(0, events.allActive(VIN).size());
    }

    @Then("no event exists")
    public void noEventExists() {
        assertEquals(0, events.allActive(VIN).size());
    }

    @Then("one event exists and each job has its own state")
    public void oneEventExistsAndEachJobHasItsOwnState() {
        assertNoError();
        List<UUID> ids = world.get(BATCH_JOBS_KEY);
        assertEquals(1, events.allActive(VIN).size());
        assertEquals(ScanStatus.REJECTED, jobs.findById(ids.get(0)).orElseThrow().status());
        assertEquals(ScanStatus.CONFIRMED, jobs.findById(ids.get(1)).orElseThrow().status());
    }

    private void extractJob() {
        ownAsMe();
        world.put(JOB_KEY, submit.submit(world.me(), VIN, png()));
        worker.processPending();
    }

    private void confirmAs(Integer km) {
        ScanJobView view = world.get(JOB_KEY);
        ConfirmScanCommand base = command(view.id(), null);
        world.put(EVENT_KEY, confirm.confirm(new ConfirmScanCommand(base.userId(), base.jobId(), null,
            base.date(), km == null ? base.odometerKm() : km, base.serviceName(), base.parts(), base.labor(),
            base.total(), null, null)));
    }

    private ConfirmScanCommand command(UUID jobId, Integer km) {
        ScanResult r = jobs.findById(jobId).orElseThrow().result();
        List<PartInput> parts = r.parts().value().stream()
            .map(p -> new PartInput(p.name(), p.qty(), p.price())).toList();
        return new ConfirmScanCommand(world.me(), jobId, null, r.date().value(),
            km == null ? r.odometerKm().value() : km, r.serviceName().value(), parts, r.labor().value(),
            r.total().value(), null, null);
    }

    private EventView savedEvent() {
        UUID id = world.get(EVENT_KEY);
        assertNotNull(id, "no event was confirmed");
        UUID viewer = world.get(OWNER_KEY) == null ? world.me() : world.get(OWNER_KEY);
        return timeline.get(viewer, VIN, null, 100).items().stream()
            .filter(e -> e.id().equals(id)).findFirst().orElseThrow();
    }

    private ScanJob stored() {
        ScanJobView view = world.get(JOB_KEY);
        return jobs.findById(view.id()).orElseThrow();
    }

    private static ScanResult withDateAndKm(LocalDate date, int km) {
        ScanResult base = FakeReceiptExtraction.defaultResult();
        return new ScanResult(base.serviceName(),
            date == null ? base.date() : new ExtractedField<>(date, 0.9),
            new ExtractedField<>(km, 0.8), base.parts(), base.labor(), base.total());
    }

    private void ownAsMe() {
        if (world.get(OWNED_KEY) == null) {
            register.register(new RegisterVehicleCommand(world.me(), VIN, "Volkswagen", "Golf", null, 2018,
                "diesel"));
            world.put(OWNED_KEY, true);
        }
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

    private void assertNoError() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
    }
}
