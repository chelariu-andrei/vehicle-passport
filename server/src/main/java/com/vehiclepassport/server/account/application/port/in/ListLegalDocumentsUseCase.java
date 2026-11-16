package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.LegalDocument;
import java.util.List;

public interface ListLegalDocumentsUseCase {

    /** One current document per type, in the requested locale or {@code en} when that locale has no text. */
    List<LegalDocument> list(String locale);
}
