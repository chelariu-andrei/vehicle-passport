package com.vehiclepassport.server.scan.domain.model;

import com.vehiclepassport.server.scan.domain.exception.IllegalScanTransitionException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A receipt scan job. Transitions:
 * PENDING -> PROCESSING (startProcessing), PROCESSING -> EXTRACTED (extracted),
 * PROCESSING -> PENDING or FAILED (retryOrFail), EXTRACTED -> CONFIRMED or REJECTED,
 * PENDING, PROCESSING or EXTRACTED -> CANCELLED (cancel).
 */
public final class ScanJob {

    private final UUID id;
    private final UUID batchId;
    private final String vin;
    private final UUID ownerId;
    private final UUID periodId;
    private final String documentKey;
    private final String contentType;
    private final Instant createdAt;

    private ScanStatus status;
    private int attempts;
    private Instant processingStartedAt;
    private ScanResult result;
    private List<ScanWarning> warnings = List.of();
    private String failureReason;

    public ScanJob(UUID id, UUID batchId, String vin, UUID ownerId, UUID periodId,
            String documentKey, String contentType, Instant createdAt) {
        this.id = id;
        this.batchId = batchId;
        this.vin = vin;
        this.ownerId = ownerId;
        this.periodId = periodId;
        this.documentKey = documentKey;
        this.contentType = contentType;
        this.createdAt = createdAt;
        this.status = ScanStatus.PENDING;
    }

    public void startProcessing(Instant at) {
        transition("start processing", ScanStatus.PROCESSING, ScanStatus.PENDING);
        attempts++;
        processingStartedAt = at;
    }

    public void extracted(ScanResult extractedResult, List<ScanWarning> extractedWarnings) {
        transition("record extraction", ScanStatus.EXTRACTED, ScanStatus.PROCESSING);
        result = extractedResult;
        warnings = List.copyOf(extractedWarnings);
        processingStartedAt = null;
    }

    /** Re-queues the job while attempts remain, otherwise marks it FAILED. */
    public void retryOrFail(String reason, int maxAttempts) {
        transition("record failure", ScanStatus.PROCESSING, ScanStatus.PROCESSING);
        failureReason = reason;
        processingStartedAt = null;
        status = attempts < maxAttempts ? ScanStatus.PENDING : ScanStatus.FAILED;
    }

    public void confirm() {
        transition("confirm", ScanStatus.CONFIRMED, ScanStatus.EXTRACTED);
    }

    public void reject() {
        transition("reject", ScanStatus.REJECTED, ScanStatus.EXTRACTED);
    }

    public void cancel() {
        transition("cancel", ScanStatus.CANCELLED, ScanStatus.PENDING, ScanStatus.PROCESSING,
                ScanStatus.EXTRACTED);
    }

    private void transition(String action, ScanStatus to, ScanStatus... allowedFrom) {
        for (ScanStatus from : allowedFrom) {
            if (status == from) {
                status = to;
                return;
            }
        }
        throw new IllegalScanTransitionException(status, action);
    }

    /** Rebuilds a stored job with every persisted field, unvalidated. For persistence adapters only. */
    public static ScanJob restore(UUID id, UUID batchId, String vin, UUID ownerId, UUID periodId,
            String documentKey, String contentType, ScanStatus status, int attempts,
            Instant processingStartedAt, ScanResult result, List<ScanWarning> warnings,
            String failureReason, Instant createdAt) {
        ScanJob job = new ScanJob(id, batchId, vin, ownerId, periodId, documentKey, contentType, createdAt);
        job.status = status;
        job.attempts = attempts;
        job.processingStartedAt = processingStartedAt;
        job.result = result;
        job.warnings = warnings;
        job.failureReason = failureReason;
        return job;
    }

    public UUID id() {
        return id;
    }

    public UUID batchId() {
        return batchId;
    }

    public String vin() {
        return vin;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public UUID periodId() {
        return periodId;
    }

    public String documentKey() {
        return documentKey;
    }

    public String contentType() {
        return contentType;
    }

    public ScanStatus status() {
        return status;
    }

    public int attempts() {
        return attempts;
    }

    public Instant processingStartedAt() {
        return processingStartedAt;
    }

    public ScanResult result() {
        return result;
    }

    public List<ScanWarning> warnings() {
        return warnings;
    }

    public String failureReason() {
        return failureReason;
    }

    public Instant createdAt() {
        return createdAt;
    }
}
