package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface CheckErasedAccountUseCase {

    /** True when the user's account was purged; their tokens may still be valid but must not be honoured. */
    boolean isErased(UUID userId);
}
