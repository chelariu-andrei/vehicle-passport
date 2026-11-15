package com.vehiclepassport.server.vehicle.application.port.in;

/** The car's look as contract strings; every part may be null. */
public record AppearanceView(String bodyType, String color, String colorHex, String finish, String wheels,
                             String rimColor, String glassTint, Boolean contrastRoof) {
}
