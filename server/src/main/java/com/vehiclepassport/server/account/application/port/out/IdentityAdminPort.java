package com.vehiclepassport.server.account.application.port.out;

import java.util.UUID;

public interface IdentityAdminPort {

    /** Deletes the sign-in identity. An identity that is already gone counts as success; any other failure throws. */
    void deleteUser(UUID userId);
}
