package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import java.time.Clock;
import java.time.Year;

public record Vehicle(Vin vin, String make, String model, String engine, int year, Fuel fuel) {

    private static final int MIN_YEAR = 1886;
    private static final int MAX_TEXT = 100;

    public Vehicle {
        if (vin == null || fuel == null) {
            throw new InvalidVehicleDataException("vin and fuel are required");
        }
        make = requireText(make, "make");
        model = requireText(model, "model");
        engine = engine == null || engine.isBlank() ? null : engine.trim();
        if (engine != null && engine.length() > MAX_TEXT) {
            throw new InvalidVehicleDataException("engine is too long");
        }
        if (year < MIN_YEAR) {
            throw new InvalidVehicleDataException("year must be at least " + MIN_YEAR);
        }
    }

    /** Builds a vehicle from raw input; the year may not exceed the current year + 1. */
    public static Vehicle of(
            Vin vin, String make, String model, String engine, int year, String fuel, Clock clock) {
        int maxYear = Year.now(clock).getValue() + 1;
        if (year > maxYear) {
            throw new InvalidVehicleDataException("year must be at most " + maxYear);
        }
        return new Vehicle(vin, make, model, engine, year, Fuel.parse(fuel));
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new InvalidVehicleDataException(field + " is required");
        }
        String trimmed = value.trim();
        if (trimmed.length() > MAX_TEXT) {
            throw new InvalidVehicleDataException(field + " is too long");
        }
        return trimmed;
    }
}
