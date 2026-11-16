package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ConsentRequiredException extends DomainException {

    public ConsentRequiredException(String detail) {
        super(ErrorKind.FORBIDDEN, "consent-required", detail);
    }
}
