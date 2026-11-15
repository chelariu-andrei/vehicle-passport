package com.vehiclepassport.server.vehicle.domain.model;

public enum PaintFinish {
    GLOSS, METALLIC, SATIN, MATTE;

    /** Null stays null; anything but the exact contract value is refused. */
    public static PaintFinish parse(String raw) {
        return LookValues.parse(PaintFinish.class, raw, "finish");
    }
}
