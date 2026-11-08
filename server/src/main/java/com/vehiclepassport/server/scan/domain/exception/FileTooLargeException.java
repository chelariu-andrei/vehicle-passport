package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class FileTooLargeException extends DomainException {

    public FileTooLargeException(String detail) {
        super(ErrorKind.TOO_LARGE, "file-too-large", detail);
    }
}
