package com.vehiclepassport.server.passport.application.port.in;

import java.util.UUID;

public interface GetPassportQrUseCase {

    byte[] ownerQr(UUID userId, UUID passportId);
}
