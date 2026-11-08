package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Duration;

@ConfigMapping(prefix = "scan")
public interface ScanConfig {

    @WithDefault("3")
    int maxAttempts();

    @WithDefault("PT5M")
    Duration processingTimeout();

    @WithDefault("10")
    int workerBatchSize();
}
