package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import java.util.Optional;

public interface LegalDocumentPort {

    Optional<LegalDocument> findCurrent(LegalDocumentType type, String locale);

    /** Current version of the document; versions are shared across locales. Throws when none is current. */
    String currentVersion(LegalDocumentType type);
}
