package com.vehiclepassport.server.vehicle.api.dto;

/** {@code plate} and {@code appearance} are always present, null when unset. */
public record VehicleResponse(String vin, String make, String model, String engine, int year, String fuel,
                              String plate, AppearanceDto appearance) {
}
