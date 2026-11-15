package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.ConsentStatusReaderPort;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/**
 * Interim adapter: reports the current terms/privacy versions from {@code legal_document} with nothing accepted
 * and no optional consents. The consent task replaces it with one that reads {@code consent_record}.
 */
@ApplicationScoped
public class LegalVersionConsentStatusReader implements ConsentStatusReaderPort {

    @Inject
    EntityManager em;

    @Override
    public ConsentStatus read(UUID userId) {
        return ConsentStatus.of(currentVersion("terms"), currentVersion("privacy"), null, null, false, false);
    }

    private String currentVersion(String type) {
        Object version = em.createNativeQuery("select min(version) from vehicle_passport.legal_document "
                        + "where type = :type and is_current")
                .setParameter("type", type).getSingleResult();
        if (version == null) {
            throw new IllegalStateException("No current legal document of type " + type);
        }
        return version.toString();
    }
}
