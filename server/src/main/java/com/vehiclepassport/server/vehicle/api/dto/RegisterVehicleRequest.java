package com.vehiclepassport.server.vehicle.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterVehicleRequest(
        @NotBlank String vin,
        @NotBlank @Size(max = 100) String make,
        @NotBlank @Size(max = 100) String model,
        @Size(max = 100) String engine,
        @NotNull @Min(1886) Integer year,
        @NotBlank String fuel) {
}
