package com.vehiclepassport.server.shared.error;

public class BatchTooLargeException extends DomainException {

    public BatchTooLargeException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "batch-too-large", detail);
    }
}
