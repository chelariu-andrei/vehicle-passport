package com.vehiclepassport.server.vehicle.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ClaimNotPendingException extends DomainException {

    public ClaimNotPendingException(String detail) {
        super(ErrorKind.CONFLICT, "claim-not-pending", detail);
    }
}
