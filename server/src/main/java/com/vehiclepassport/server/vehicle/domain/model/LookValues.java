package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;

/** Strict parsing for the look enums: exact contract spelling only, null stays null. */
final class LookValues {

    private LookValues() {
    }

    static <E extends Enum<E>> E parse(Class<E> type, String raw, String field) {
        if (raw == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, raw);
        } catch (IllegalArgumentException e) {
            throw new InvalidVehicleDataException("unknown " + field + ": " + raw);
        }
    }
}
