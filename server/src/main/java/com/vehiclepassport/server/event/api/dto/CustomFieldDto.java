package com.vehiclepassport.server.event.api.dto;

import jakarta.validation.constraints.NotNull;

/** Lengths (label 1..40, value 1..200) count after trimming, so the domain checks them. */
public record CustomFieldDto(@NotNull String label, @NotNull String value) {
}
