package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

@Alternative
@ApplicationScoped
public class FakeEventDocumentStorage implements DocumentStoragePort, Resettable {

    private record Stored(byte[] content, String contentType) {
    }

    private final Map<String, Stored> objects = new HashMap<>();

    public void put(String key, byte[] content, String contentType) {
        objects.put(key, new Stored(content, contentType));
    }

    @Override
    public EventDocument open(String key) {
        Stored stored = objects.get(key);
        if (stored == null) {
            throw new EventNotFoundException("No object for key " + key);
        }
        return new EventDocument(new ByteArrayInputStream(stored.content()), stored.contentType());
    }

    @Override
    public void reset() {
        objects.clear();
    }
}
