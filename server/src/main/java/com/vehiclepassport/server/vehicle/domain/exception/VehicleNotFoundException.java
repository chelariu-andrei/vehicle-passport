package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class VehicleNotFoundException extends DomainException {

    public VehicleNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "vehicle-not-found", detail);
    }
}
