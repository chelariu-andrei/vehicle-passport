package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.scan.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Alternative
@ApplicationScoped
public class FakeScanDocumentStorage implements DocumentStoragePort, Resettable {

    private final Map<String, byte[]> objects = new LinkedHashMap<>();

    @Override
    public void put(String key, Path file, String contentType) {
        try {
            objects.put(key, Files.readAllBytes(file));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public byte[] read(String key) {
        byte[] content = objects.get(key);
        if (content == null) {
            throw new IllegalStateException("No object for key " + key);
        }
        return content;
    }

    public Set<String> keys() {
        return objects.keySet();
    }

    @Override
    public void reset() {
        objects.clear();
    }
}
