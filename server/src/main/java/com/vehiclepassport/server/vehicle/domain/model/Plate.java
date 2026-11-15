package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import java.util.regex.Pattern;

/**
 * The number plate as the owner typed it, already normalised by the client. Owner-only: it never enters a passport
 * and is cleared when the car changes hands. Error details never repeat the value.
 */
public record Plate(String value) {

    private static final Pattern FORMAT = Pattern.compile("^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$");

    public Plate {
        if (value == null || !FORMAT.matcher(value).matches()) {
            throw new InvalidVehicleDataException("plate is not valid");
        }
    }

    public static Plate ofNullable(String raw) {
        return raw == null ? null : new Plate(raw);
    }

    @Override
    public String toString() {
        return "Plate[redacted]";
    }
}
