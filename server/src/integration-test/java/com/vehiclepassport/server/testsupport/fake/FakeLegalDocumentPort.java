package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.LocalDate;
import java.util.Optional;

/** Every legal document is at version 1.0 in every locale, as the V9 seed ships them. */
@Alternative
@ApplicationScoped
public class FakeLegalDocumentPort implements LegalDocumentPort {

    @Override
    public Optional<LegalDocument> findCurrent(LegalDocumentType type, String locale) {
        return Optional.of(new LegalDocument(type, "1.0", locale, type.value(), "body", LocalDate.parse("2026-01-01")));
    }

    @Override
    public String currentVersion(LegalDocumentType type) {
        return "1.0";
    }
}
