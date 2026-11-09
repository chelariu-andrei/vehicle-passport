package com.vehiclepassport.server.passport.application.port.in;

public interface GetPublicPassportUseCase {

    /** Unknown, revoked and expired tokens all fail the same way. */
    PublicPassportView get(String token);
}
