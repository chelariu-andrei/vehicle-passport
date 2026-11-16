package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum Currency {
    RON("RON"), EUR("EUR"), USD("USD");

    private final String value;

    Currency(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static Currency fromValue(String value) {
        for (Currency v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown currency: " + value);
    }
}
