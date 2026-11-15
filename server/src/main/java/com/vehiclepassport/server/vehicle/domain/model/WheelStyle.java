package com.vehiclepassport.server.vehicle.domain.model;

public enum WheelStyle {
    FIVE_SPOKE, MULTI_SPOKE, AERO;

    /** Null stays null; anything but the exact contract value is refused. */
    public static WheelStyle parse(String raw) {
        return LookValues.parse(WheelStyle.class, raw, "wheels");
    }
}
