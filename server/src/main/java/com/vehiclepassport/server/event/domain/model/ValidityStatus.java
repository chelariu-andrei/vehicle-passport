package com.vehiclepassport.server.event.domain.model;

/** Computed at read time, never stored (spec §5.6). */
public enum ValidityStatus {
    VALID, EXPIRING, EXPIRED, SUPERSEDED, UNKNOWN
}
