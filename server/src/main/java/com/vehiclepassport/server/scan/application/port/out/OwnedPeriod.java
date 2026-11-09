package com.vehiclepassport.server.scan.application.port.out;

import java.util.UUID;

/** The caller's open ownership period and the canonical VIN; callers use this VIN from then on. */
public record OwnedPeriod(String vin, UUID periodId) {
}
