package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class InvalidVinException extends DomainException {

    public InvalidVinException(String detail) {
        super(ErrorKind.INVALID, "invalid-vin", detail);
    }
}
