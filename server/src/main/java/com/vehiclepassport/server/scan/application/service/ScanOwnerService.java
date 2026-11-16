package com.vehiclepassport.server.scan.application.service;

import com.vehiclepassport.server.scan.application.port.in.DetachOwnerUseCase;
import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

@ApplicationScoped
public class ScanOwnerService implements DetachOwnerUseCase {

    private final ScanJobRepositoryPort jobs;

    @Inject
    public ScanOwnerService(ScanJobRepositoryPort jobs) {
        this.jobs = jobs;
    }

    @Override
    @Transactional
    public void detach(UUID ownerId, UUID tombstone) {
        jobs.detachOwner(ownerId, tombstone);
    }
}
