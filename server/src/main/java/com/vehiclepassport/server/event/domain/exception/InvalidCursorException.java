package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class InvalidCursorException extends DomainException {

    public InvalidCursorException(String detail) {
        super(ErrorKind.INVALID, "invalid-cursor", detail);
    }
}
