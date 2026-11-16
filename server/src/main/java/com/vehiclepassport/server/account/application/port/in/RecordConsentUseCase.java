package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import java.util.UUID;

public interface RecordConsentUseCase {

    /**
     * Appends one record per accepted legal version and per toggle that changes. Accepting a version that is not
     * the current one fails with consent-version-outdated and writes nothing.
     */
    ConsentStatus record(UUID userId, ConsentChange change);
}
