package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface ExportMyDataUseCase {

    /** Everything stored about the user. The token claims are only needed to build the profile section. */
    AccountExport export(UUID userId, String emailClaim, boolean emailVerified);
}
