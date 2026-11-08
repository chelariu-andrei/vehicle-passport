package com.vehiclepassport.server.scan.domain.model;

public record ExtractedField<T>(T value, double confidence) {

    public ExtractedField {
        if (!(confidence >= 0.0 && confidence <= 1.0)) {
            throw new IllegalArgumentException("confidence must be within 0..1: " + confidence);
        }
    }
}
