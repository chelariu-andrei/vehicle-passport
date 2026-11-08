package com.vehiclepassport.server.event.domain.model;

/** Declared in ascending order of trust. */
public enum EvidenceLevel {
    ESTIMATED, USER_CONFIRMED, DOCUMENTED, VERIFIED;

    public boolean isAtLeast(EvidenceLevel other) {
        return compareTo(other) >= 0;
    }
}
