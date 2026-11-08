package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class DocumentedEventImmutableException extends DomainException {

    public DocumentedEventImmutableException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "documented-event-immutable", detail);
    }
}
