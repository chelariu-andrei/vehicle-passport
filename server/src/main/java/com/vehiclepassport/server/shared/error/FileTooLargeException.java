package com.vehiclepassport.server.shared.error;

public class FileTooLargeException extends DomainException {

    public FileTooLargeException(String detail) {
        super(ErrorKind.TOO_LARGE, "file-too-large", detail);
    }
}
