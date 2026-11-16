package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Native SQL: a flat read-only table with a composite key, no entity needed. */
@ApplicationScoped
public class LegalDocumentRepository implements LegalDocumentPort {

    @Inject
    EntityManager em;

    @Override
    public Optional<LegalDocument> findCurrent(LegalDocumentType type, String locale) {
        List<?> rows = em.createNativeQuery("select version, title, body_markdown, effective_date "
                        + "from vehicle_passport.legal_document where type = :type and locale = :locale and is_current")
                .setParameter("type", type.value())
                .setParameter("locale", locale)
                .getResultList();
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Object[] r = (Object[]) rows.get(0);
        return Optional.of(new LegalDocument(type, (String) r[0], locale, (String) r[1], (String) r[2],
                (LocalDate) r[3]));
    }

    @Override
    public String currentVersion(LegalDocumentType type) {
        List<?> rows = em.createNativeQuery("select version from vehicle_passport.legal_document "
                        + "where type = :type and locale = 'en' and is_current")
                .setParameter("type", type.value())
                .getResultList();
        if (rows.isEmpty()) {
            throw new IllegalStateException("No current legal document of type " + type.value());
        }
        return (String) rows.get(0);
    }
}
