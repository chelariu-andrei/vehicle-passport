package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "passport")
public interface PassportConfig {

    String publicBaseUrl();
}
