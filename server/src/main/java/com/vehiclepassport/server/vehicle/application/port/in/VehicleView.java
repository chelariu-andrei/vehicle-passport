package com.vehiclepassport.server.vehicle.application.port.in;

public record VehicleView(String vin, String make, String model, String engine, int year, String fuel) {
}
