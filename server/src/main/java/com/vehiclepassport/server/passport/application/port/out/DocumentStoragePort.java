package com.vehiclepassport.server.passport.application.port.out;

public interface DocumentStoragePort {

    void put(String key, byte[] content, String contentType);

    byte[] read(String key);
}
