package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class DeletionNotScheduledException extends DomainException {

    public DeletionNotScheduledException(String detail) {
        super(ErrorKind.NOT_FOUND, "deletion-not-scheduled", detail);
    }
}
