package com.vehiclepassport.server.vehicle.application.port.in;

/** {@code plate} is owner-only and never goes into a passport. {@code plate} and {@code appearance} may be null. */
public record VehicleView(String vin, String make, String model, String engine, int year, String fuel,
                          String plate, AppearanceView appearance) {
}
