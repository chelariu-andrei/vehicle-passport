package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.OwnedData;
import java.util.UUID;

/**
 * Reads what the vehicle, event and passport features hold for an owner.
 */
public interface OwnerDataExportPort {

    OwnedData exportFor(UUID ownerId);
}
