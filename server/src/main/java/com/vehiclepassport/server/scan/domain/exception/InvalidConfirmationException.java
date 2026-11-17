package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

/** A confirm request that does not fit a scan: a type a scan cannot become, or ITP-only fields on another type. */
public class InvalidConfirmationException extends DomainException {

    public InvalidConfirmationException(String detail) {
        super(ErrorKind.INVALID, "validation-failed", detail);
    }
}
