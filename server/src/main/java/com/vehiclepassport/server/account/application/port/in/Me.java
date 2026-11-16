package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.OwnerStats;
import com.vehiclepassport.server.account.domain.model.Profile;

/** The caller's account. {@code emailVerified} comes from the token, not from storage. */
public record Me(Profile profile, boolean emailVerified, OwnerStats stats, ConsentStatus consent) {

    public Me withEmailVerified(boolean verified) {
        return new Me(profile, verified, stats, consent);
    }
}
