package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;

public interface GetLegalDocumentUseCase {

    /** Current version; an unsupported or missing locale falls back to {@code en}. */
    LegalDocument get(LegalDocumentType type, String locale);
}
