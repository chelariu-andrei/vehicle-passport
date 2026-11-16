package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class DeletionAlreadyScheduledException extends DomainException {

    public DeletionAlreadyScheduledException(String detail) {
        super(ErrorKind.CONFLICT, "deletion-already-scheduled", detail);
    }
}
