package com.vehiclepassport.server.vehicle.domain.model;

public enum GlassTint {
    LIGHT, DARK;

    /** Null stays null; anything but the exact contract value is refused. */
    public static GlassTint parse(String raw) {
        return LookValues.parse(GlassTint.class, raw, "glassTint");
    }
}
