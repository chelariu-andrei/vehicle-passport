package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.Settings;
import java.util.UUID;

public interface GetSettingsUseCase {

    /** Stored settings, or {@link Settings#defaults()} when the user has none; never writes. */
    Settings get(UUID userId);
}
