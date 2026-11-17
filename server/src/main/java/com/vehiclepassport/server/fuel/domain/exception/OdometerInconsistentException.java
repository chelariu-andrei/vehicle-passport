package com.vehiclepassport.server.fuel.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class OdometerInconsistentException extends DomainException {

    public OdometerInconsistentException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "odometer-inconsistent", detail);
    }
}
