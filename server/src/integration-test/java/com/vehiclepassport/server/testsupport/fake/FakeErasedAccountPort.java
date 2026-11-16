package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.ErasedAccountPort;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** In-memory erased subjects for the database-less profiles; the real check is covered by AccountPurgeIT. */
@Alternative
@ApplicationScoped
public class FakeErasedAccountPort implements ErasedAccountPort, Resettable {

    private final Set<UUID> erased = new HashSet<>();

    @Override
    public synchronized void markErased(UUID userId, Instant at) {
        erased.add(userId);
    }

    @Override
    public synchronized boolean isErased(UUID userId) {
        return erased.contains(userId);
    }

    @Override
    public synchronized void reset() {
        erased.clear();
    }
}
