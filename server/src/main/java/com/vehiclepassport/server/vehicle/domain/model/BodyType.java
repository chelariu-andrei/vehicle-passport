package com.vehiclepassport.server.vehicle.domain.model;

public enum BodyType {
    HATCHBACK, SEDAN, ESTATE, SUV, COUPE, MPV, PICKUP;

    /** Null stays null; anything but the exact contract value is refused. */
    public static BodyType parse(String raw) {
        return LookValues.parse(BodyType.class, raw, "bodyType");
    }
}
