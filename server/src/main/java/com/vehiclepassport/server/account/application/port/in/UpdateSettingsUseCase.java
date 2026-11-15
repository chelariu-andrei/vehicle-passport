package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.Settings;
import java.util.UUID;

public interface UpdateSettingsUseCase {

    /** Full replace. */
    Settings replace(UUID userId, Settings settings);
}
