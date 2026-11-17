package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;

/** A display-only {@code label: value} row. Both are trimmed; label 1..40 chars, value 1..200 chars. */
public record CustomField(String label, String value) {

    private static final int MAX_LABEL = 40;
    private static final int MAX_VALUE = 200;

    public CustomField {
        label = label == null ? "" : label.trim();
        value = value == null ? "" : value.trim();
        if (label.isEmpty() || label.length() > MAX_LABEL) {
            throw new InvalidEventException("Custom field label must be 1 to " + MAX_LABEL + " characters");
        }
        if (value.isEmpty() || value.length() > MAX_VALUE) {
            throw new InvalidEventException("Custom field value must be 1 to " + MAX_VALUE + " characters");
        }
    }
}