package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum SupportKind {
    PROBLEM("problem"), QUESTION("question");

    private final String value;

    SupportKind(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static SupportKind fromValue(String value) {
        for (SupportKind v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown support kind: " + value);
    }
}
