package com.vehiclepassport.server.account.infrastructure.scheduler;

import com.vehiclepassport.server.account.application.port.in.PurgeAccountsUseCase;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;

/** Daily trigger; the use case logs counts only. */
@ApplicationScoped
public class AccountPurgeJob {

    @Inject
    PurgeAccountsUseCase purge;
    @Inject
    Clock clock;

    @Scheduled(cron = "{account.purge.cron}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void run() {
        purge.purgeDue(clock.instant());
    }
}
