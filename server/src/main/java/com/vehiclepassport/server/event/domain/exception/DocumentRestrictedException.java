package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class DocumentRestrictedException extends DomainException {

    public DocumentRestrictedException(String detail) {
        super(ErrorKind.FORBIDDEN, "document-restricted", detail);
    }
}
