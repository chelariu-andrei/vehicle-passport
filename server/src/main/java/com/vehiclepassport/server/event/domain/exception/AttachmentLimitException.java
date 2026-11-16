package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class AttachmentLimitException extends DomainException {

    public AttachmentLimitException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "attachment-limit", detail);
    }
}
