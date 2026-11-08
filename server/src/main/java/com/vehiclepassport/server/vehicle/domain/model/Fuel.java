package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import java.util.Locale;

public enum Fuel {
    PETROL, DIESEL, HYBRID, ELECTRIC, LPG, OTHER;

    public static Fuel parse(String raw) {
        if (raw == null) {
            throw new InvalidVehicleDataException("fuel is required");
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidVehicleDataException("unknown fuel: " + raw);
        }
    }
}
