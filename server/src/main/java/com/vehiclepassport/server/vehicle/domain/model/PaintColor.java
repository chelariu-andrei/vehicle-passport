package com.vehiclepassport.server.vehicle.domain.model;

public enum PaintColor {
    WHITE, BLACK, SILVER, GREY, BLUE, RED, GREEN, BEIGE, BROWN, YELLOW, ORANGE, GOLD;

    /** Null stays null; anything but the exact contract value is refused. */
    public static PaintColor parse(String raw) {
        return LookValues.parse(PaintColor.class, raw, "color");
    }
}
