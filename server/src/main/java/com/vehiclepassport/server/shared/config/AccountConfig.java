package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

@ConfigMapping(prefix = "account")
public interface AccountConfig {

    Consent consent();

    Deletion deletion();

    Purge purge();

    interface Consent {

        /** When false the consent gate lets every request through; tests turn it off except where they exercise it. */
        @WithDefault("true")
        boolean enforce();
    }

    interface Deletion {

        /** Days between asking to delete the account and the purge. */
        @WithDefault("30")
        int graceDays();
    }

    interface Purge {

        /** Quartz cron for the job that purges accounts whose grace period has ended. */
        @WithDefault("0 0 3 * * ?")
        String cron();
    }
}
