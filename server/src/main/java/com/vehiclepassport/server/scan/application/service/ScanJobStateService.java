package com.vehiclepassport.server.scan.application.service;

import com.vehiclepassport.server.scan.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import com.vehiclepassport.server.shared.config.ScanConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.transaction.Transactional.TxType;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Short transactional steps of the worker; the slow provider call happens between them, outside any transaction. */
@ApplicationScoped
public class ScanJobStateService {

    private static final int ORPHAN_SCAN_LIMIT = 200;

    private final ScanJobRepositoryPort jobs;
    private final ActiveOwnerPort owners;
    private final ScanConfig config;
    private final Clock clock;

    @Inject
    public ScanJobStateService(ScanJobRepositoryPort jobs, ActiveOwnerPort owners, ScanConfig config,
            Clock clock) {
        this.jobs = jobs;
        this.owners = owners;
        this.config = config;
        this.clock = clock;
    }

    /** Claims the next PENDING job, cancelling those whose ownership period has ended. */
    @Transactional
    public Optional<ScanJob> claimNext() {
        Optional<ScanJob> next = jobs.lockNextPending();
        while (next.isPresent()) {
            ScanJob job = next.get();
            if (owners.isPeriodOpen(job.periodId())) {
                job.startProcessing(clock.instant());
                jobs.save(job);
                return next;
            }
            job.cancel();
            jobs.save(job);
            next = jobs.lockNextPending();
        }
        return Optional.empty();
    }

    @Transactional
    public void recordSuccess(UUID jobId, ScanResult result, List<ScanWarning> warnings) {
        jobs.findByIdForUpdate(jobId).filter(j -> j.status() == ScanStatus.PROCESSING).ifPresent(job -> {
            job.extracted(result, warnings);
            jobs.save(job);
        });
    }

    @Transactional
    public void recordFailure(UUID jobId, String reason) {
        jobs.findByIdForUpdate(jobId).filter(j -> j.status() == ScanStatus.PROCESSING).ifPresent(job -> {
            job.retryOrFail(reason, config.maxAttempts());
            jobs.save(job);
        });
    }

    @Transactional
    public void recoverStuck() {
        for (ScanJob job : jobs.findStuck(clock.instant().minus(config.processingTimeout()))) {
            job.retryOrFail("processing timeout", config.maxAttempts());
            jobs.save(job);
        }
    }

    @Transactional
    public void cancelOrphans() {
        for (ScanJob job : jobs.findOpen(ORPHAN_SCAN_LIMIT)) {
            if (!owners.isPeriodOpen(job.periodId())) {
                job.cancel();
                jobs.save(job);
            }
        }
    }

    /**
     * Cancels a not yet terminal job whose ownership period has ended, in its own transaction so the
     * cancellation survives a caller that goes on to throw. Returns whether the job is now CANCELLED.
     */
    @Transactional(TxType.REQUIRES_NEW)
    public boolean cancelIfPeriodClosed(UUID jobId) {
        Optional<ScanJob> found = jobs.findByIdForUpdate(jobId);
        if (found.isEmpty()) {
            return false;
        }
        ScanJob job = found.get();
        if (job.status() == ScanStatus.CANCELLED) {
            return true;
        }
        if (!isInFlight(job.status()) || owners.isPeriodOpen(job.periodId())) {
            return false;
        }
        job.cancel();
        jobs.save(job);
        return true;
    }

    static boolean isInFlight(ScanStatus status) {
        return status == ScanStatus.PENDING || status == ScanStatus.PROCESSING
                || status == ScanStatus.EXTRACTED;
    }
}
