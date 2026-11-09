package com.vehiclepassport.server.scan.application.service;

import com.vehiclepassport.server.scan.application.port.in.ConfirmScanCommand;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.GetScanJobUseCase;
import com.vehiclepassport.server.scan.application.port.in.RejectScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanBatchView;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanBatchUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.scan.application.port.out.ConfirmedEvent;
import com.vehiclepassport.server.scan.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.scan.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.scan.application.port.out.EventSavePort;
import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.exception.IllegalScanTransitionException;
import com.vehiclepassport.server.scan.domain.exception.ScanJobNotFoundException;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.scan.domain.model.ScanFilePolicy;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ScanService implements SubmitScanUseCase, SubmitScanBatchUseCase, GetScanJobUseCase,
        ConfirmScanUseCase, RejectScanUseCase {

    private static final int HEAD_BYTES = 8;
    private static final String DEFAULT_TYPE = "SERVICE";
    private static final String DEFAULT_CURRENCY = "RON";

    private final ScanJobRepositoryPort jobs;
    private final DocumentStoragePort storage;
    private final ActiveOwnerPort owners;
    private final EventSavePort events;
    private final ScanJobStateService state;
    private final Clock clock;

    @Inject
    public ScanService(ScanJobRepositoryPort jobs, DocumentStoragePort storage, ActiveOwnerPort owners,
            EventSavePort events, ScanJobStateService state, Clock clock) {
        this.jobs = jobs;
        this.storage = storage;
        this.owners = owners;
        this.events = events;
        this.state = state;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ScanJobView submit(UUID userId, String vin, UploadedFile file) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        check(file);
        return toView(store(UUID.randomUUID(), owned.vin(), userId, owned.periodId(), file));
    }

    @Override
    @Transactional
    public ScanBatchView submit(UUID userId, String vin, List<UploadedFile> files) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        ScanFilePolicy.checkBatchSize(files.size());
        files.forEach(this::check);
        UUID batchId = UUID.randomUUID();
        List<ScanJobView> views = new ArrayList<>();
        for (UploadedFile file : files) {
            views.add(toView(store(batchId, owned.vin(), userId, owned.periodId(), file)));
        }
        return new ScanBatchView(batchId, views);
    }

    @Override
    @Transactional
    public ScanJobView get(UUID userId, UUID jobId) {
        ScanJob job = jobs.findById(jobId).filter(j -> j.ownerId().equals(userId))
                .orElseThrow(ScanJobNotFoundException::new);
        if (ScanJobStateService.isInFlight(job.status()) && !owners.isPeriodOpen(job.periodId())) {
            job = jobs.findByIdForUpdate(jobId).orElseThrow(ScanJobNotFoundException::new);
            if (ScanJobStateService.isInFlight(job.status())) {
                job.cancel();
                jobs.save(job);
            }
        }
        return toView(job);
    }

    @Override
    @Transactional
    public UUID confirm(ConfirmScanCommand c) {
        ScanJob job = lockOwned(c.userId(), c.jobId(), "confirm");
        UUID eventId = events.saveDocumented(new ConfirmedEvent(c.userId(), job.vin(),
                c.eventType() == null ? DEFAULT_TYPE : c.eventType(), c.date(), c.odometerKm(), c.total(),
                c.currency() == null ? DEFAULT_CURRENCY : c.currency(), c.notes(), c.serviceName(), c.parts(),
                c.labor(), job.documentKey()));
        job.confirm();
        jobs.save(job);
        return eventId;
    }

    @Override
    @Transactional
    public void reject(UUID userId, UUID jobId) {
        ScanJob job = lockOwned(userId, jobId, "reject");
        job.reject();
        jobs.save(job);
    }

    /**
     * Loads the caller's job, checks the caller is still the active owner in the job's period and that the
     * job is EXTRACTED. A job whose ownership ended is cancelled in a separate transaction first, so the
     * cancellation is not rolled back by the refusal. The row is locked only after that, because the
     * separate transaction needs the same row.
     */
    private ScanJob lockOwned(UUID userId, UUID jobId, String action) {
        ScanJob seen = jobs.findById(jobId).filter(j -> j.ownerId().equals(userId))
                .orElseThrow(ScanJobNotFoundException::new);
        UUID period;
        try {
            period = owners.assertActiveOwner(seen.vin(), userId).periodId();
        } catch (DomainException e) {
            state.cancelIfPeriodClosed(jobId);
            throw e;
        }
        if (!period.equals(seen.periodId())) {
            if (state.cancelIfPeriodClosed(jobId)) {
                throw new IllegalScanTransitionException(ScanStatus.CANCELLED, action);
            }
            throw new ScanJobNotFoundException();
        }
        ScanJob job = jobs.findByIdForUpdate(jobId).orElseThrow(ScanJobNotFoundException::new);
        if (job.status() != ScanStatus.EXTRACTED) {
            throw new IllegalScanTransitionException(job.status(), action);
        }
        return job;
    }

    private ScanJob store(UUID batchId, String vin, UUID userId, UUID periodId, UploadedFile file) {
        UUID jobId = UUID.randomUUID();
        String key = "scans/" + vin + "/" + jobId;
        storage.put(key, file.path(), file.contentType());
        ScanJob job = new ScanJob(jobId, batchId, vin, userId, periodId, key, file.contentType(), clock.instant());
        jobs.save(job);
        return job;
    }

    private void check(UploadedFile file) {
        ScanFilePolicy.check(file.contentType(), file.size(), head(file));
    }

    private static byte[] head(UploadedFile file) {
        try (InputStream in = Files.newInputStream(file.path())) {
            return in.readNBytes(HEAD_BYTES);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static ScanJobView toView(ScanJob job) {
        return new ScanJobView(job.id(), job.status().name(), job.result(),
                job.warnings().stream().map(ScanWarning::name).toList());
    }
}
