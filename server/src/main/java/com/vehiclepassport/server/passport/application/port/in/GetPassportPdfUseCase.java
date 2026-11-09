package com.vehiclepassport.server.passport.application.port.in;

import java.util.UUID;

public interface GetPassportPdfUseCase {

    byte[] publicPdf(String token);

    byte[] ownerPdf(UUID userId, UUID passportId);
}
