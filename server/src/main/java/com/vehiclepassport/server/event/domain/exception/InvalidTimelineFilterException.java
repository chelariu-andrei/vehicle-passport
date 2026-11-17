package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

/** A timeline filter that cannot be applied: unknown type or component, impossible date, from after to. */
public class InvalidTimelineFilterException extends DomainException {

    public InvalidTimelineFilterException(String detail) {
        super(ErrorKind.INVALID, "validation-failed", detail);
    }
}
