package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.AccountErasurePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Nothing is ever due in the database-less profile; the purge itself is covered by AccountPurgeIT. */
@Alternative
@ApplicationScoped
public class FakeAccountErasurePort implements AccountErasurePort {

    @Override
    public List<UUID> findDue(Instant now) {
        return List.of();
    }

    @Override
    public boolean lockIfDue(UUID userId, Instant now) {
        return false;
    }

    @Override
    public void anonymiseConsents(UUID userId, String subjectHash) {
    }

    @Override
    public void detachSupportReports(UUID userId) {
    }

    @Override
    public void deleteSettings(UUID userId) {
    }

    @Override
    public void deleteProfile(UUID userId) {
    }
}
