package com.vehiclepassport.server.vehicle.domain.model;

public enum RimColor {
    SILVER, BLACK, BODY;

    /** Null stays null; anything but the exact contract value is refused. */
    public static RimColor parse(String raw) {
        return LookValues.parse(RimColor.class, raw, "rimColor");
    }
}
