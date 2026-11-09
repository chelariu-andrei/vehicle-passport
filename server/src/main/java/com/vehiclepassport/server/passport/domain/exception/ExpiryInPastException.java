package com.vehiclepassport.server.passport.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ExpiryInPastException extends DomainException {

    public ExpiryInPastException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "expiry-in-past", detail);
    }
}
