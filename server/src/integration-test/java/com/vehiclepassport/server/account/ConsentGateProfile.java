package com.vehiclepassport.server.account;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import java.util.Map;

/** The persistence profile with the consent gate switched on; every other IT runs with it off. */
public class ConsentGateProfile extends PersistenceProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("account.consent.enforce", "true");
    }
}
