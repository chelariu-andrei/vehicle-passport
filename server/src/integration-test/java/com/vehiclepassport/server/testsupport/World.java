package com.vehiclepassport.server.testsupport;

import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class World {

    private final Map<String, Object> values = new HashMap<>();
    private RuntimeException lastError;

    public UUID user(String name) {
        return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8));
    }

    public UUID me() {
        return user("me");
    }

    public void attempt(Runnable action) {
        lastError = null;
        try {
            action.run();
        } catch (RuntimeException e) {
            lastError = e;
        }
    }

    public RuntimeException lastError() {
        return lastError;
    }

    public void put(String key, Object value) {
        values.put(key, value);
    }

    @SuppressWarnings("unchecked")
    public <T> T get(String key) {
        return (T) values.get(key);
    }

    public void reset() {
        values.clear();
        lastError = null;
    }
}
