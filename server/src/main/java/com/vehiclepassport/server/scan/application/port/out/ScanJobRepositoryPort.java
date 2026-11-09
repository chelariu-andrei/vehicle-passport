package com.vehiclepassport.server.scan.application.port.out;

import com.vehiclepassport.server.scan.domain.model.ScanJob;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScanJobRepositoryPort {

    void save(ScanJob job);

    Optional<ScanJob> findById(UUID id);

    Optional<ScanJob> findByIdForUpdate(UUID id);

    /** Locks and returns the oldest PENDING job, skipping rows locked by other workers. */
    Optional<ScanJob> lockNextPending();

    /** PROCESSING jobs whose processing started before the given instant. */
    List<ScanJob> findStuck(Instant startedBefore);

    /** PENDING or EXTRACTED jobs. */
    List<ScanJob> findOpen(int limit);
}
