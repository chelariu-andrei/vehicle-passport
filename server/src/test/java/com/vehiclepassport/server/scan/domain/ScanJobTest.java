package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.scan.domain.exception.IllegalScanTransitionException;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ScanJobTest {

    private static final Instant T0 = Instant.parse("2026-11-08T10:00:00Z");

    private static ScanJob newJob() {
        return new ScanJob(UUID.randomUUID(), null, "WVWZZZ1JZXW000001", UUID.randomUUID(),
                UUID.randomUUID(), "scans/doc.pdf", "application/pdf", T0);
    }

    private static ScanResult emptyResult() {
        return new ScanResult(null, null, null, null, null, null);
    }

    private static ScanJob processing() {
        ScanJob job = newJob();
        job.startProcessing(T0);
        return job;
    }

    private static ScanJob extracted() {
        ScanJob job = processing();
        job.extracted(emptyResult(), List.of());
        return job;
    }

    @Test
    void new_job_is_PENDING_with_no_attempts() {
        ScanJob job = newJob();

        assertEquals(ScanStatus.PENDING, job.status());
        assertEquals(0, job.attempts());
    }

    @Test
    void pending_to_processing() {
        ScanJob job = newJob();

        job.startProcessing(T0);

        assertEquals(ScanStatus.PROCESSING, job.status());
        assertEquals(1, job.attempts());
        assertEquals(T0, job.processingStartedAt());
    }

    @Test
    void processing_to_extracted() {
        ScanJob job = processing();
        List<ScanWarning> warnings = List.of(ScanWarning.TOTAL_MISMATCH);

        job.extracted(emptyResult(), warnings);

        assertEquals(ScanStatus.EXTRACTED, job.status());
        assertEquals(warnings, job.warnings());
    }

    @Test
    void processing_to_pending_when_retries_remain() {
        ScanJob job = processing();

        job.retryOrFail("timeout", 3);

        assertEquals(ScanStatus.PENDING, job.status());
        assertEquals("timeout", job.failureReason());
    }

    @Test
    void processing_to_failed_when_no_retries_remain() {
        ScanJob job = processing();

        job.retryOrFail("boom", 1);

        assertEquals(ScanStatus.FAILED, job.status());
    }

    @Test
    void third_failure_is_FAILED() {
        ScanJob job = newJob();

        for (int attempt = 1; attempt <= 2; attempt++) {
            job.startProcessing(T0);
            job.retryOrFail("boom", 3);
            assertEquals(ScanStatus.PENDING, job.status());
        }
        job.startProcessing(T0);
        job.retryOrFail("boom", 3);

        assertEquals(ScanStatus.FAILED, job.status());
        assertEquals(3, job.attempts());
    }

    @Test
    void extracted_to_confirmed() {
        ScanJob job = extracted();

        job.confirm();

        assertEquals(ScanStatus.CONFIRMED, job.status());
    }

    @Test
    void extracted_to_rejected() {
        ScanJob job = extracted();

        job.reject();

        assertEquals(ScanStatus.REJECTED, job.status());
    }

    @Test
    void pending_to_cancelled() {
        ScanJob job = newJob();

        job.cancel();

        assertEquals(ScanStatus.CANCELLED, job.status());
    }

    @Test
    void processing_to_cancelled() {
        ScanJob job = processing();

        job.cancel();

        assertEquals(ScanStatus.CANCELLED, job.status());
    }

    @Test
    void extracted_to_cancelled() {
        ScanJob job = extracted();

        job.cancel();

        assertEquals(ScanStatus.CANCELLED, job.status());
    }

    @Test
    void confirm_from_pending_throws() {
        ScanJob job = newJob();

        assertIllegal(job::confirm);
    }

    @Test
    void double_confirm_throws() {
        ScanJob job = extracted();
        job.confirm();

        assertIllegal(job::confirm);
    }

    @Test
    void reject_from_processing_throws() {
        ScanJob job = processing();

        assertIllegal(job::reject);
    }

    @Test
    void extracted_from_pending_throws() {
        ScanJob job = newJob();

        assertIllegal(() -> job.extracted(emptyResult(), List.of()));
    }

    @Test
    void start_processing_twice_throws() {
        ScanJob job = processing();

        assertIllegal(() -> job.startProcessing(T0));
    }

    @Test
    void cancel_from_confirmed_throws() {
        ScanJob job = extracted();
        job.confirm();

        assertIllegal(job::cancel);
    }

    @Test
    void illegal_transition_has_conflict_kind_and_scan_state_conflict_code() {
        ScanJob job = newJob();

        IllegalScanTransitionException ex = assertThrows(IllegalScanTransitionException.class, job::confirm);

        assertEquals(com.vehiclepassport.server.shared.error.ErrorKind.CONFLICT, ex.kind());
        assertEquals("scan-state-conflict", ex.code());
    }

    @Test
    void restored_job_keeps_state_and_enforces_transitions() {
        ScanJob job = ScanJob.restore(UUID.randomUUID(), null, "WVWZZZ1JZXW000001", UUID.randomUUID(),
                UUID.randomUUID(), "scans/doc.pdf", "application/pdf", ScanStatus.EXTRACTED, 1, null,
                emptyResult(), List.of(ScanWarning.DATE_IN_FUTURE), null, T0);

        assertEquals(ScanStatus.EXTRACTED, job.status());
        assertEquals(1, job.attempts());
        assertEquals(List.of(ScanWarning.DATE_IN_FUTURE), job.warnings());

        job.confirm();
        assertEquals(ScanStatus.CONFIRMED, job.status());
        assertIllegal(job::cancel);
    }

    private static void assertIllegal(Runnable action) {
        IllegalScanTransitionException ex = assertThrows(IllegalScanTransitionException.class, action::run);
        assertEquals("scan-state-conflict", ex.code());
    }
}
