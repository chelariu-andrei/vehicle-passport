package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;

/** Coverage and insurer are required; the insurer is trimmed to 1..100 chars, the policy number to at most 60. */
public record InsuranceDetails(InsuranceCoverage coverage, String insurer, String policyNumber)
        implements EventDetails {

    private static final int MAX_INSURER = 100;
    private static final int MAX_POLICY = 60;

    public InsuranceDetails {
        if (coverage == null) {
            throw InvalidEventException.validation("Insurance coverage is required");
        }
        insurer = insurer == null ? "" : insurer.trim();
        if (insurer.isEmpty() || insurer.length() > MAX_INSURER) {
            throw InvalidEventException.validation("Insurer must be 1 to " + MAX_INSURER + " characters");
        }
        policyNumber = policyNumber == null || policyNumber.isBlank() ? null : policyNumber.trim();
        if (policyNumber != null && policyNumber.length() > MAX_POLICY) {
            throw InvalidEventException.validation("Policy number must be at most " + MAX_POLICY + " characters");
        }
    }

    @Override
    public DetailsKind kind() {
        return DetailsKind.INSURANCE;
    }
}