package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.IdentityAdminPort;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Records the deleted identities; {@link #failWith} makes the next calls fail until {@link #reset}. */
@Alternative
@ApplicationScoped
public class FakeIdentityAdminPort implements IdentityAdminPort, Resettable {

    private final List<UUID> deleted = new ArrayList<>();
    private RuntimeException failure;

    @Override
    public synchronized void deleteUser(UUID userId) {
        if (failure != null) {
            throw failure;
        }
        deleted.add(userId);
    }

    public synchronized void failWith(RuntimeException e) {
        this.failure = e;
    }

    public synchronized void recover() {
        this.failure = null;
    }

    public synchronized List<UUID> deleted() {
        return List.copyOf(deleted);
    }

    @Override
    public synchronized void reset() {
        deleted.clear();
        failure = null;
    }
}
