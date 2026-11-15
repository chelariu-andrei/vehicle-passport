package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum Appearance {
    SYSTEM("system"), DARK("dark"), LIGHT("light");

    private final String value;

    Appearance(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static Appearance fromValue(String value) {
        for (Appearance v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown appearance: " + value);
    }
}
