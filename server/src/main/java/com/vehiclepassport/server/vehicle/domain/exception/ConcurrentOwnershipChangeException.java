package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ConcurrentOwnershipChangeException extends DomainException {

    public ConcurrentOwnershipChangeException(String detail) {
        super(ErrorKind.CONFLICT, "ownership-conflict", detail);
    }
}
