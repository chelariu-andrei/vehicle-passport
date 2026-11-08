package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class InvalidEventException extends DomainException {

    public InvalidEventException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "invalid-event", detail);
    }
}
