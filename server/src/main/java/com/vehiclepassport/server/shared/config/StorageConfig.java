package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "storage")
public interface StorageConfig {

    String endpoint();

    String region();

    String accessKey();

    String secretKey();

    String bucket();
}
