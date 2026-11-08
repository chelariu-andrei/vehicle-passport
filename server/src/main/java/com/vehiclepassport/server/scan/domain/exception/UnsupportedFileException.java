package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class UnsupportedFileException extends DomainException {

    public UnsupportedFileException(String detail) {
        super(ErrorKind.UNSUPPORTED_MEDIA, "unsupported-file", detail);
    }
}
