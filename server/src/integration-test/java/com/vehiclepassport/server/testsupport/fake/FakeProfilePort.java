package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.domain.model.Profile;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeProfilePort implements ProfilePort, Resettable {

    private final Map<UUID, Profile> store = new LinkedHashMap<>();

    @Override
    public synchronized Profile upsertIfAbsent(Profile profile) {
        return store.computeIfAbsent(profile.id(), id -> profile);
    }

    @Override
    public synchronized Optional<Profile> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public synchronized void save(Profile profile) {
        store.put(profile.id(), profile);
    }

    @Override
    public synchronized void reset() {
        store.clear();
    }
}
