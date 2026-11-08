package com.vehiclepassport.server.testsupport.smoke;

import io.quarkus.test.junit.QuarkusTestProfile;

public class PersistenceProfile implements QuarkusTestProfile {

    @Override
    public String getConfigProfile() {
        return "persistence";
    }
}
