package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.PurgeAccountsUseCase;
import com.vehiclepassport.server.account.application.port.out.AccountErasurePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.UUID;
import org.jboss.logging.Logger;

/** Finds the accounts whose grace period has ended and purges each in its own transaction. */
@ApplicationScoped
public class AccountPurgeService implements PurgeAccountsUseCase {

    private static final Logger LOG = Logger.getLogger(AccountPurgeService.class);

    private final AccountErasurePort erasure;
    private final SingleAccountPurgeService step;

    @Inject
    public AccountPurgeService(AccountErasurePort erasure, SingleAccountPurgeService step) {
        this.erasure = erasure;
        this.step = step;
    }

    @Override
    @Transactional
    public int purgeDue(Instant now) {
        int done = 0;
        int failed = 0;
        for (UUID userId : erasure.findDue(now)) {
            try {
                step.purge(userId);
                done++;
            } catch (RuntimeException e) {
                failed++;
                // Counts and exception type only: ids, emails and cause messages can be personal data.
                LOG.warnf("Account purge failed (%s); it is retried on the next run", e.getClass().getSimpleName());
            }
        }
        if (done > 0 || failed > 0) {
            LOG.infof("Account purge finished: %d purged, %d to retry", done, failed);
        }
        return done;
    }
}
