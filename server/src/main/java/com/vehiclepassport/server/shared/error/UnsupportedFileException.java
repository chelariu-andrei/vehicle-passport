package com.vehiclepassport.server.shared.error;

public class UnsupportedFileException extends DomainException {

    public UnsupportedFileException(String detail) {
        super(ErrorKind.UNSUPPORTED_MEDIA, "unsupported-file", detail);
    }
}
