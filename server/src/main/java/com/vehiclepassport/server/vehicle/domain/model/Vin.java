package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVinException;
import java.util.Locale;
import java.util.regex.Pattern;

public record Vin(String value) {

    private static final Pattern FORMAT = Pattern.compile("[A-HJ-NPR-Z0-9]{17}");

    public Vin {
        if (value == null || !FORMAT.matcher(value).matches()) {
            throw new InvalidVinException("VIN must be 17 characters of A-Z and 0-9, excluding I, O and Q");
        }
    }

    public static Vin of(String raw) {
        if (raw == null) {
            throw new InvalidVinException("VIN is required");
        }
        return new Vin(raw.trim().toUpperCase(Locale.ROOT));
    }
}
