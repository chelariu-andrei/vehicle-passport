package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class PriorPeriodEventException extends DomainException {

    public PriorPeriodEventException(String detail) {
        super(ErrorKind.FORBIDDEN, "event-from-prior-owner", detail);
    }
}
