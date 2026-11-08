package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class InvalidVehicleDataException extends DomainException {

    public InvalidVehicleDataException(String detail) {
        super(ErrorKind.INVALID, "invalid-vehicle", detail);
    }
}
