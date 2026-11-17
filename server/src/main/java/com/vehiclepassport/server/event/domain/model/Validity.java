package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import java.time.LocalDate;

/** The period a document is valid for, both days inclusive. validUntil is null only for an ITP without one. */
public record Validity(LocalDate validFrom, LocalDate validUntil) {

    public Validity {
        if (validFrom == null) {
            throw InvalidEventException.validation("Valid from is required");
        }
        if (validUntil != null && validUntil.isBefore(validFrom)) {
            throw InvalidEventException.validation("Valid until cannot be before valid from");
        }
    }
}