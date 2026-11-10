package com.vehiclepassport.server.vehicle.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Pattern;

/** VehicleAppearance in the contract: every field optional and omitted when unset, never sent as null. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppearanceDto(
        String bodyType,
        String color,
        @Pattern(regexp = "^#[0-9a-f]{6}$") String colorHex,
        String finish,
        String wheels,
        String rimColor,
        String glassTint,
        Boolean contrastRoof) {
}
