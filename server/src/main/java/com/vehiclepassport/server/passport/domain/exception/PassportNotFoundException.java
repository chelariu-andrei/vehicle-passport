package com.vehiclepassport.server.passport.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class PassportNotFoundException extends DomainException {

    public PassportNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "passport-not-found", detail);
    }
}
