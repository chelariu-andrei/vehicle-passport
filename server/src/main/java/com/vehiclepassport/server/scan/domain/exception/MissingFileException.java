package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class MissingFileException extends DomainException {

    public MissingFileException(String detail) {
        super(ErrorKind.INVALID, "validation-failed", detail);
    }
}
