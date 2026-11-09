package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

/** The open ownership period of the caller, with the canonical (trimmed, upper-case) VIN. */
public record ActiveOwnership(UUID periodId, String vin) {
}
