package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum DistanceUnit {
    KM("km"), MI("mi");

    private final String value;

    DistanceUnit(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static DistanceUnit fromValue(String value) {
        for (DistanceUnit v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown distance unit: " + value);
    }
}
