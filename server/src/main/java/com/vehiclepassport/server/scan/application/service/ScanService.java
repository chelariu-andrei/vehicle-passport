package com.vehiclepassport.server.scan.application.service;

import com.vehiclepassport.server.scan.application.port.in.GetScanJobUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanBatchView;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanBatchUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.scan.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.exception.ScanJobNotFoundException;
import com.vehiclepassport.server.scan.domain.model.ScanFilePolicy;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
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
public class ScanService implements SubmitScanUseCase, SubmitScanBatchUseCase, GetScanJobUseCase {

    private static final int HEAD_BYTES = 8;

    private final ScanJobRepositoryPort jobs;
    private final DocumentStoragePort storage;
    private final ActiveOwnerPort owners;
    private final Clock clock;

    @Inject
    public ScanService(ScanJobRepositoryPort jobs, DocumentStoragePort storage, ActiveOwnerPort owners,
            Clock clock) {
        this.jobs = jobs;
        this.storage = storage;
        this.owners = owners;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ScanJobView submit(UUID userId, String vin, UploadedFile file) {
        UUID periodId = owners.assertActiveOwner(vin, userId);
        check(file);
        return toView(store(UUID.randomUUID(), vin, userId, periodId, file));
    }

    @Override
    @Transactional
    public ScanBatchView submit(UUID userId, String vin, List<UploadedFile> files) {
        UUID periodId = owners.assertActiveOwner(vin, userId);
        ScanFilePolicy.checkBatchSize(files.size());
        files.forEach(this::check);
        UUID batchId = UUID.randomUUID();
        List<ScanJobView> views = new ArrayList<>();
        for (UploadedFile file : files) {
            views.add(toView(store(batchId, vin, userId, periodId, file)));
        }
        return new ScanBatchView(batchId, views);
    }

    @Override
    public ScanJobView get(UUID userId, UUID jobId) {
        ScanJob job = jobs.findById(jobId).filter(j -> j.ownerId().equals(userId))
                .orElseThrow(ScanJobNotFoundException::new);
        return toView(job);
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
