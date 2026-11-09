package com.vehiclepassport.server.event.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EventRequest(
        @NotNull @Pattern(regexp = "SERVICE|REPAIR|TIRES|ITP") String type,
        @NotNull LocalDate date,
        @NotNull @Min(0) Integer odometerKm,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal costAmount,
        @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
        @Size(max = 2000) String notes) {
}
