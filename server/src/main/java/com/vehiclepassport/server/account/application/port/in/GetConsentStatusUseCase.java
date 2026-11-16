package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import java.util.UUID;

public interface GetConsentStatusUseCase {

    ConsentStatus status(UUID userId);
}
