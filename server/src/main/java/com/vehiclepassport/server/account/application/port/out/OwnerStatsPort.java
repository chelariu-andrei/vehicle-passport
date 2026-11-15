package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.OwnerStats;
import java.util.UUID;

public interface OwnerStatsPort {

    OwnerStats statsFor(UUID ownerId);
}
