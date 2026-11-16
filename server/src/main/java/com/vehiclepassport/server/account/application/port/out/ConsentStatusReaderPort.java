package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import java.util.UUID;

/** Narrow read of the consent state for /me. Replaced by the real consent adapter in the consent task. */
public interface ConsentStatusReaderPort {

    ConsentStatus read(UUID userId);
}
