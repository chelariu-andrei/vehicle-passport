package com.vehiclepassport.server.account.infrastructure.adapter;

import com.vehiclepassport.server.account.application.port.in.GetConsentStatusUseCase;
import com.vehiclepassport.server.account.application.port.out.ConsentStatusReaderPort;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Lets the profile use case read consent state through the consent use case instead of duplicating its rules. */
@ApplicationScoped
public class ConsentStatusReaderAdapter implements ConsentStatusReaderPort {

    @Inject
    GetConsentStatusUseCase consent;

    @Override
    public ConsentStatus read(UUID userId) {
        return consent.status(userId);
    }
}
