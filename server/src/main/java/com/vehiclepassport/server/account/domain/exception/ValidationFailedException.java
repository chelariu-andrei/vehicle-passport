package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ValidationFailedException extends DomainException {

    public ValidationFailedException(String detail) {
        super(ErrorKind.INVALID, "validation-failed", detail);
    }
}
