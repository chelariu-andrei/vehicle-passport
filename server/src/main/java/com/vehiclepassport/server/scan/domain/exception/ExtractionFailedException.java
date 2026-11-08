package com.vehiclepassport.server.scan.domain.exception;

/** Internal worker failure during receipt extraction; carries no HTTP kind or code. */
public class ExtractionFailedException extends RuntimeException {

    public ExtractionFailedException(String message) {
        super(message);
    }
}
