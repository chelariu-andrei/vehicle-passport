package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class AttachmentProtectedException extends DomainException {

    public AttachmentProtectedException(String detail) {
        super(ErrorKind.UNPROCESSABLE, "attachment-protected", detail);
    }
}
