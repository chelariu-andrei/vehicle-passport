package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ConsentVersionOutdatedException extends DomainException {

    public ConsentVersionOutdatedException(String detail) {
        super(ErrorKind.CONFLICT, "consent-version-outdated", detail);
    }
}
