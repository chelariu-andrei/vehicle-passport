package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.Settings;
import java.util.Optional;
import java.util.UUID;

public interface SettingsPort {

    Optional<Settings> find(UUID userId);

    /** Insert or fully replace the user's row. */
    void upsert(UUID userId, Settings settings);
}
