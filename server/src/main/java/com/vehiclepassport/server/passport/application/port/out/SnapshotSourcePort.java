package com.vehiclepassport.server.passport.application.port.out;

import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import java.util.List;
import java.util.UUID;

public interface SnapshotSourcePort {

    /** Authorises userId as the active owner of vin, then returns the vehicle and its whole history. */
    SnapshotSource load(String vin, UUID userId);

    record SnapshotSource(SnapshotVehicle vehicle, List<SnapshotEvent> events) {
    }
}
