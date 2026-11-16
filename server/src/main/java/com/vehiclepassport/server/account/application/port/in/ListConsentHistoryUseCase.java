package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import java.util.List;
import java.util.UUID;

public interface ListConsentHistoryUseCase {

    /** Newest first. */
    List<ConsentRecord> history(UUID userId);
}
