package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum LegalDocumentType {
    TERMS("terms"), PRIVACY("privacy"), DATA_SHARING("data-sharing");

    private final String value;

    LegalDocumentType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static LegalDocumentType fromValue(String value) {
        for (LegalDocumentType v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown legal document type: " + value);
    }
}
