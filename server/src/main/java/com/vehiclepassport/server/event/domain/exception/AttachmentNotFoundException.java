package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class AttachmentNotFoundException extends DomainException {

    public AttachmentNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "attachment-not-found", detail);
    }
}
