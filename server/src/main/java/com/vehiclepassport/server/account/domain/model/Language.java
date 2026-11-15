package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum Language {
    SYSTEM("system"), RO("ro"), EN("en");

    private final String value;

    Language(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static Language fromValue(String value) {
        for (Language v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown language: " + value);
    }
}
