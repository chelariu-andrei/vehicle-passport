package com.vehiclepassport.server.scan.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.scan.application.port.in.GetScanJobUseCase;
import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanBatchView;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanBatchUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.shared.config.ScanConfig;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakeReceiptExtraction;
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
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class ScanSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String JOB_KEY = "scan.job";
    private static final String BATCH_KEY = "scan.batch";
    private static final String HOSTILE_NAME_KEY = "scan.hostileName";
    private static final String PNG_TYPE = "image/png";
    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01};

    @Inject
    World world;

    @Inject
    TestClock clock;

    @Inject
    ScanConfig config;

    @Inject
    SubmitScanUseCase submit;

    @Inject
    SubmitScanBatchUseCase submitBatch;

    @Inject
    GetScanJobUseCase getJob;

    @Inject
    ProcessScanJobsUseCase worker;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ReleaseVehicleUseCase release;

    @Inject
    GetTimelineUseCase timeline;

    @Inject
    FakeScanJobRepository jobs;

    @Inject
    FakeScanDocumentStorage storage;

    @Inject
    FakeReceiptExtraction extraction;

    @Given("I submitted an invoice photo for vehicle V")
    public void iSubmittedAnInvoicePhoto() {
        ownAsMe();
        submitPhoto();
    }

    @Given("extraction fails {int} time(s) for my job")
    public void extractionFailsForMyJob(int times) {
        ownAsMe();
        submitPhoto();
        extraction.willFail(times);
    }

    @Given("extraction returned parts {int}, labor {int}, total {int}")
    public void extractionReturned(int parts, int labor, int total) {
        ownAsMe();
        ScanResult base = FakeReceiptExtraction.defaultResult();
        extraction.willReturn(new ScanResult(base.serviceName(), base.date(), base.odometerKm(),
            new ExtractedField<>(List.of(new ExtractedPart("Part", BigDecimal.ONE, BigDecimal.valueOf(parts))), 0.9),
            new ExtractedField<>(BigDecimal.valueOf(labor), 0.9),
            new ExtractedField<>(BigDecimal.valueOf(total), 0.9)));
        submitPhoto();
        worker.processPending();
    }

    @Given("extraction finished")
    public void extractionFinished() {
        ownAsMe();
        submitPhoto();
        worker.processPending();
    }

    @Given("a job has been PROCESSING for longer than the timeout")
    public void aJobHasBeenProcessing() {
        stuckJob(1);
    }

    @Given("a job has been PROCESSING for longer than the timeout and has used {int} attempts")
    public void aJobHasBeenProcessingWithAttempts(int attempts) {
        stuckJob(attempts);
    }

    @Given("I released V")
    public void iReleasedV() {
        release.release(VIN, world.me());
    }

    @When("I submit an invoice photo for vehicle V")
    public void iSubmitAnInvoicePhoto() {
        world.attempt(this::submitPhoto);
    }

    @When("I submit a file whose multipart name is {string}")
    public void iSubmitAFileWithName(String multipartName) {
        // UploadedFile has no name field, so the hostile name has nowhere to travel; the file on disk is anonymous.
        world.put(HOSTILE_NAME_KEY, multipartName);
        world.attempt(this::submitPhoto);
    }

    @When("I submit a batch of {int} files")
    public void iSubmitABatch(int count) {
        List<UploadedFile> files = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            files.add(png());
        }
        world.attempt(() -> world.put(BATCH_KEY, submitBatch.submit(world.me(), VIN, files)));
    }

    @When("I submit a batch of {int} files where one is a text file named {string}")
    public void iSubmitABatchWithTextFile(int count, String name) {
        List<UploadedFile> files = new ArrayList<>();
        for (int i = 0; i < count - 1; i++) {
            files.add(png());
        }
        files.add(file("this is not a pdf".getBytes(StandardCharsets.UTF_8), "application/pdf"));
        world.attempt(() -> world.put(BATCH_KEY, submitBatch.submit(world.me(), VIN, files)));
    }

    @When("the worker runs")
    public void theWorkerRuns() {
        worker.processPending();
    }

    @When("the worker runs {int} time(s)")
    public void theWorkerRunsTimes(int times) {
        for (int i = 0; i < times; i++) {
            worker.processPending();
        }
    }

    @Then("the job is {word}")
    public void theJobIs(String status) {
        assertEquals(status, currentJob().status());
    }

    @Then("the job is EXTRACTED with confidence on each field")
    public void theJobIsExtractedWithConfidence() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        ScanResult r = view.result();
        assertNotNull(r);
        for (ExtractedField<?> f : List.of(r.serviceName(), r.date(), r.odometerKm(), r.parts(), r.labor(),
                r.total())) {
            assertNotNull(f);
            assertNotNull(f.value());
            assertTrue(f.confidence() > 0.0 && f.confidence() <= 1.0);
        }
    }

    @Then("extraction was called {int} times")
    public void extractionWasCalled(int times) {
        assertEquals(times, extraction.calls());
    }

    @Then("extraction was not called")
    public void extractionWasNotCalled() {
        assertEquals(0, extraction.calls());
    }

    @Then("{int} PENDING jobs exist in one batch")
    public void pendingJobsInOneBatch(int count) {
        assertNoError();
        ScanBatchView batch = world.get(BATCH_KEY);
        assertEquals(count, batch.jobs().size());
        assertEquals(count, batch.jobs().stream().map(ScanJobView::id).distinct().count());
        assertTrue(batch.jobs().stream().allMatch(j -> "PENDING".equals(j.status())));
        List<ScanJob> stored = jobs.all();
        assertEquals(count, stored.size());
        assertTrue(stored.stream().allMatch(j -> j.status() == ScanStatus.PENDING));
        assertEquals(1, stored.stream().map(ScanJob::batchId).distinct().count());
        assertEquals(batch.batchId(), stored.get(0).batchId());
        assertEquals(count, storage.keys().size());
    }

    @Then("no file was stored and no job exists")
    public void noFileStoredAndNoJob() {
        assertTrue(storage.keys().isEmpty(), "stored: " + storage.keys());
        assertTrue(jobs.all().isEmpty());
    }

    @Then("the result carries a total-mismatch warning")
    public void theResultCarriesTotalMismatch() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        assertTrue(view.warnings().contains("TOTAL_MISMATCH"), view.warnings().toString());
    }

    @Then("no event exists until I confirm")
    public void noEventExists() {
        assertEquals("EXTRACTED", currentJob().status());
        assertTrue(timeline.get(world.me(), VIN, null, 100).items().isEmpty());
    }

    @Then("the stored key is the scan key of the job and does not contain {string}")
    public void theStoredKeyIsTheScanKey(String fragment) {
        assertNoError();
        ScanJobView view = world.get(JOB_KEY);
        assertEquals(List.of("scans/" + VIN + "/" + view.id()), List.copyOf(storage.keys()));
        for (String key : storage.keys()) {
            assertFalse(key.contains(fragment), key);
            assertFalse(key.contains(".."), key);
        }
        assertEquals("../../x.pdf", world.get(HOSTILE_NAME_KEY));
    }

    private void stuckJob(int attempts) {
        ownAsMe();
        submitPhoto();
        ScanJobView view = world.get(JOB_KEY);
        ScanJob job = jobs.findById(view.id()).orElseThrow();
        jobs.save(ScanJob.restore(job.id(), job.batchId(), job.vin(), job.ownerId(), job.periodId(),
            job.documentKey(), job.contentType(), ScanStatus.PROCESSING, attempts, clock.instant(), null,
            List.of(), null, job.createdAt()));
        clock.advance(config.processingTimeout().plus(Duration.ofMinutes(1)));
    }

    private ScanJobView currentJob() {
        ScanJobView view = world.get(JOB_KEY);
        return getJob.get(world.me(), view.id());
    }

    private void ownAsMe() {
        register.register(new RegisterVehicleCommand(world.me(), VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private void submitPhoto() {
        world.put(JOB_KEY, submit.submit(world.me(), VIN, png()));
    }

    private UploadedFile png() {
        return file(PNG_BYTES, PNG_TYPE);
    }

    private UploadedFile file(byte[] content, String contentType) {
        try {
            Path path = Files.createTempFile("scan-test", ".bin");
            path.toFile().deleteOnExit();
            Files.write(path, content);
            return new UploadedFile(path, contentType, content.length);
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
