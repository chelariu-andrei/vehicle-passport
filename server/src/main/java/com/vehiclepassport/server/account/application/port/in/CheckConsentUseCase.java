package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface CheckConsentUseCase {

    /** True when the user has accepted the current terms and privacy versions. */
    boolean isCurrent(UUID userId);
}
