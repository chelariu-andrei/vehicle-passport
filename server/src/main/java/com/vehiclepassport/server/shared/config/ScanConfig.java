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

    Extraction extraction();

    Ocr ocr();

    interface Extraction {

        /** {@code paddle} selects the OCR adapter, anything else the no-provider one. */
        @WithDefault("none")
        String provider();
    }

    interface Ocr {

        @WithDefault("http://127.0.0.1:8090")
        String baseUrl();

        @WithDefault("PT90S")
        Duration timeout();
    }
}
