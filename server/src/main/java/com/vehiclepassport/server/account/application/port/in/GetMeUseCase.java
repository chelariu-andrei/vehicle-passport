package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface GetMeUseCase {

    /** Creates the profile on the first call and refreshes the stored email when the claim differs. */
    Me get(UUID userId, String emailClaim, boolean emailVerified);
}
