package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

@ConfigMapping(prefix = "account")
public interface AccountConfig {

    Consent consent();

    interface Consent {

        /** When false the consent gate lets every request through; tests turn it off except where they exercise it. */
        @WithDefault("true")
        boolean enforce();
    }
}
