package com.vehiclepassport.server.account.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class LegalDocumentNotFoundException extends DomainException {

    public LegalDocumentNotFoundException(String detail) {
        super(ErrorKind.NOT_FOUND, "legal-document-not-found", detail);
    }
}
