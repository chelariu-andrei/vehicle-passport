package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import java.util.regex.Pattern;

/** How the illustrative model is drawn. Visual only; every part is optional; it stays with the car on transfer. */
public record Appearance(BodyType bodyType, PaintColor color, String colorHex, PaintFinish finish,
                         WheelStyle wheels, RimColor rimColor, GlassTint glassTint, Boolean contrastRoof) {

    private static final Pattern HEX = Pattern.compile("^#[0-9a-f]{6}$");

    public Appearance {
        if (colorHex != null && !HEX.matcher(colorHex).matches()) {
            throw new InvalidVehicleDataException("colorHex is not valid");
        }
    }

    public boolean isEmpty() {
        return bodyType == null && color == null && colorHex == null && finish == null && wheels == null
                && rimColor == null && glassTint == null && contrastRoof == null;
    }

    /** An absent or empty look is stored and returned as no look. */
    public static Appearance orNull(Appearance a) {
        return a == null || a.isEmpty() ? null : a;
    }
}
