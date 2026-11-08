package com.vehiclepassport.server.shared.error;

public enum ErrorKind {
    INVALID(400),
    FORBIDDEN(403),
    NOT_FOUND(404),
    CONFLICT(409),
    TOO_LARGE(413),
    UNSUPPORTED_MEDIA(415),
    UNPROCESSABLE(422);

    private final int status;

    ErrorKind(int status) {
        this.status = status;
    }

    public int status() {
        return status;
    }
}
