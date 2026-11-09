package com.vehiclepassport.server.scan.api;

import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class ScanWorkerScheduler {

    private final ProcessScanJobsUseCase worker;

    @Inject
    public ScanWorkerScheduler(ProcessScanJobsUseCase worker) {
        this.worker = worker;
    }

    @Scheduled(every = "${scan.worker-interval:10s}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void tick() {
        worker.processPending();
    }
}
