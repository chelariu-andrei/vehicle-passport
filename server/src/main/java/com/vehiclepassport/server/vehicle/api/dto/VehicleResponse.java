package com.vehiclepassport.server.vehicle.api.dto;

public record VehicleResponse(String vin, String make, String model, String engine, int year, String fuel) {
}
