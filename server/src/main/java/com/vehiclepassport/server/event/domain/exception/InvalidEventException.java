package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

/**
 * An event the rules refuse. Two flavours share this class so callers can catch either:
 * <ul>
 *   <li>the constructor: a business rule on a value of the right shape (date in the future, negative km or cost,
 *       bad currency), 422 {@code invalid-event};</li>
 *   <li>{@link #validation(String)}: the request does not fit its type (spec §5.1 table: missing or leftover
 *       details, validity or label, unknown enum value, too many custom fields), 400 {@code validation-failed}.</li>
 * </ul>
 */
public class InvalidEventException extends DomainException {

    public InvalidEventException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "invalid-event", detail);
    }

    private InvalidEventException(ErrorKind kind, String code, String detail) {
        super(kind, code, detail);
    }

    public static InvalidEventException validation(String detail) {
        return new InvalidEventException(ErrorKind.INVALID, "validation-failed", detail);
    }
}
