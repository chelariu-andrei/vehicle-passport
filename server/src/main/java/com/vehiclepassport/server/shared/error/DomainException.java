package com.vehiclepassport.server.shared.error;

public abstract class DomainException extends RuntimeException {

    private final ErrorKind kind;
    private final String code;

    protected DomainException(ErrorKind kind, String code, String detail) {
        super(detail);
        this.kind = kind;
        this.code = code;
    }

    public ErrorKind kind() {
        return kind;
    }

    public String code() {
        return code;
    }
}
