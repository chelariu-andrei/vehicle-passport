package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.SettingsPort;
import com.vehiclepassport.server.account.domain.model.Settings;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeSettingsPort implements SettingsPort, Resettable {

    private final Map<UUID, Settings> store = new LinkedHashMap<>();

    @Override
    public synchronized Optional<Settings> find(UUID userId) {
        return Optional.ofNullable(store.get(userId));
    }

    @Override
    public synchronized void upsert(UUID userId, Settings settings) {
        store.put(userId, settings);
    }

    @Override
    public synchronized void reset() {
        store.clear();
    }
}
