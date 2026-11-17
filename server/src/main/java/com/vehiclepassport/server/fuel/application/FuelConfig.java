package com.vehiclepassport.server.fuel.application;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.math.BigDecimal;

/** Fuel settings; services pass these values into the pure domain calculators. */
@ConfigMapping(prefix = "fuel")
public interface FuelConfig {

    Alert alert();

    interface Alert {

        /** Increase over the baseline mean, in percent, above which the alert fires (strictly). */
        @WithDefault("15")
        BigDecimal thresholdPct();

        /** How many included segments before the latest form the baseline. */
        @WithDefault("5")
        int window();

        /** Fewest baseline segments needed before the alert can fire. */
        @WithDefault("3")
        int minBaseline();
    }
}
