package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ClaimNotFoundException extends DomainException {

    public ClaimNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "claim-not-found", detail);
    }
}
