package com.vehiclepassport.server.fuel.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

/** 422 {@code invalid-fuel-entry}, or 400 {@code validation-failed} through {@link #validation(String)}. */
public class InvalidFuelEntryException extends DomainException {

    public InvalidFuelEntryException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "invalid-fuel-entry", detail);
    }

    private InvalidFuelEntryException(ErrorKind kind, String code, String detail) {
        super(kind, code, detail);
    }

    public static InvalidFuelEntryException validation(String detail) {
        return new InvalidFuelEntryException(ErrorKind.INVALID, "validation-failed", detail);
    }
}
