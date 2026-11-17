package com.vehiclepassport.server.fuel.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class FuelEntryNotFoundException extends DomainException {

    public FuelEntryNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "fuel-entry-not-found", detail);
    }
}
