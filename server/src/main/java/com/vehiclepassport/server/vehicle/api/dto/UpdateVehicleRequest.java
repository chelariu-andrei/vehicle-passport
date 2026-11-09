package com.vehiclepassport.server.vehicle.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** Partial update; an absent field keeps its current value. */
public record UpdateVehicleRequest(
        @Size(min = 1, max = 100) String make,
        @Size(min = 1, max = 100) String model,
        @Size(max = 100) String engine,
        @Min(1886) Integer year,
        String fuel) {

    @JsonIgnore
    @AssertTrue(message = "at least one field is required")
    public boolean isNotEmpty() {
        return make != null || model != null || engine != null || year != null || fuel != null;
    }
}
