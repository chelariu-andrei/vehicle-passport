package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public record DisplayName(String value) {

    public static final int MAX_LENGTH = 80;

    public DisplayName {
        if (value == null || value.isEmpty() || value.length() > MAX_LENGTH) {
            throw new ValidationFailedException("displayName must be 1 to " + MAX_LENGTH + " characters");
        }
        if (value.chars().anyMatch(c -> c < 0x20 || c == 0x7F)) {
            throw new ValidationFailedException("displayName must not contain control characters");
        }
    }

    public static DisplayName of(String raw) {
        if (raw == null) {
            throw new ValidationFailedException("displayName must not be null");
        }
        return new DisplayName(raw.trim());
    }
}
