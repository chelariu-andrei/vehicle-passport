package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.passport.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.passport.domain.exception.PassportNotFoundException;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.HashMap;
import java.util.Map;

@Alternative
@ApplicationScoped
public class FakePassportFileStorage implements DocumentStoragePort, Resettable {

    private final Map<String, byte[]> objects = new HashMap<>();

    @Override
    public void put(String key, byte[] content, String contentType) {
        objects.put(key, content.clone());
    }

    @Override
    public byte[] read(String key) {
        byte[] content = objects.get(key);
        if (content == null) {
            throw new PassportNotFoundException("No object for key " + key);
        }
        return content.clone();
    }

    @Override
    public void reset() {
        objects.clear();
    }
}
