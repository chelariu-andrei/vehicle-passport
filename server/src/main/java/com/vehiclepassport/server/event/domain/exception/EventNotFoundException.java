package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class EventNotFoundException extends DomainException {

    public EventNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "event-not-found", detail);
    }
}
