package com.vehiclepassport.server.scan.application.service;

import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import com.vehiclepassport.server.scan.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.scan.application.port.out.OdometerCheckPort;
import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.ReceiptValidator;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import com.vehiclepassport.server.shared.config.ScanConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Not transactional on purpose: each state change is its own short transaction in ScanJobStateService. */
@ApplicationScoped
public class ScanProcessingService implements ProcessScanJobsUseCase {

    private final ScanJobStateService state;
    private final DocumentStoragePort storage;
    private final ReceiptExtractionPort extraction;
    private final OdometerCheckPort odometer;
    private final ScanConfig config;
    private final Clock clock;

    @Inject
    public ScanProcessingService(ScanJobStateService state, DocumentStoragePort storage,
            ReceiptExtractionPort extraction, OdometerCheckPort odometer, ScanConfig config, Clock clock) {
        this.state = state;
        this.storage = storage;
        this.extraction = extraction;
        this.odometer = odometer;
        this.config = config;
        this.clock = clock;
    }

    @Override
    public int processPending() {
        state.recoverStuck();
        state.cancelOrphans();
        int processed = 0;
        while (processed < config.workerBatchSize()) {
            Optional<ScanJob> claimed = state.claimNext();
            if (claimed.isEmpty()) {
                break;
            }
            processed++;
            if (!process(claimed.get())) {
                break; // a failed extraction ends this run; the next tick continues
            }
        }
        return processed;
    }

    private boolean process(ScanJob job) {
        ScanResult result;
        try {
            result = extraction.extract(storage.read(job.documentKey()), job.contentType());
        } catch (ExtractionFailedException e) {
            state.recordFailure(job.id(), e.getMessage());
            return false;
        }
        state.recordSuccess(job.id(), result, validate(job, result));
        return true;
    }

    private List<ScanWarning> validate(ScanJob job, ScanResult result) {
        LocalDate date = result.date() == null ? null : result.date().value();
        Integer km = result.odometerKm() == null ? null : result.odometerKm().value();
        boolean consistent = date == null || km == null || odometer.isConsistent(job.vin(), date, km);
        return ReceiptValidator.validate(result, LocalDate.now(clock), consistent);
    }
}
