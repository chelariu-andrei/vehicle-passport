package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum ConsentType {
    TERMS("terms"), PRIVACY("privacy"), MARKETING("marketing"), ANALYTICS("analytics");

    private final String value;

    ConsentType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static ConsentType fromValue(String value) {
        for (ConsentType v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown consent type: " + value);
    }
}
