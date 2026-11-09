package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeScanJobRepository implements ScanJobRepositoryPort, Resettable {

    private final Map<UUID, ScanJob> store = new LinkedHashMap<>();

    @Override
    public void save(ScanJob job) {
        store.put(job.id(), job);
    }

    @Override
    public Optional<ScanJob> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<ScanJob> findByIdForUpdate(UUID id) {
        return findById(id);
    }

    @Override
    public Optional<ScanJob> lockNextPending() {
        return store.values().stream().filter(j -> j.status() == ScanStatus.PENDING).findFirst();
    }

    @Override
    public List<ScanJob> findStuck(Instant startedBefore) {
        return store.values().stream()
            .filter(j -> j.status() == ScanStatus.PROCESSING && j.processingStartedAt() != null
                && j.processingStartedAt().isBefore(startedBefore))
            .toList();
    }

    @Override
    public List<ScanJob> findOpen(int limit) {
        return store.values().stream()
            .filter(j -> j.status() == ScanStatus.PENDING || j.status() == ScanStatus.EXTRACTED)
            .limit(limit)
            .toList();
    }

    public List<ScanJob> all() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void reset() {
        store.clear();
    }
}
