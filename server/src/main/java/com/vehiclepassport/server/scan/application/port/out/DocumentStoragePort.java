package com.vehiclepassport.server.scan.application.port.out;

import java.nio.file.Path;

public interface DocumentStoragePort {

    void put(String key, Path file, String contentType);

    byte[] read(String key);
}
