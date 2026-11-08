package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class BatchTooLargeException extends DomainException {

    public BatchTooLargeException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "batch-too-large", detail);
    }
}
