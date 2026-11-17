package com.vehiclepassport.server.fuel.api.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request shape of {@code FuelEntryRequest}; unknown fields are refused by the global Jackson setting. A null
 * {@code fullTank} means true and a null {@code missedPrevious} false (the contract defaults). Which fuel types fit
 * the car, grade versus charge type and the date limit are the domain's rules (422 {@code invalid-fuel-entry}).
 */
public record FuelEntryRequest(
        @NotNull LocalDate date,
        @NotNull @Min(0) Integer odometerKm,
        @NotNull @Pattern(regexp = "PETROL|DIESEL|LPG|ELECTRIC") String fuelType,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("9999") BigDecimal quantity,
        @NotNull @DecimalMin("0") @DecimalMax("999999") BigDecimal total,
        @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
        Boolean fullTank,
        Boolean missedPrevious,
        @Pattern(regexp = "STANDARD|PREMIUM") String grade,
        @Pattern(regexp = "HOME|AC_PUBLIC|DC_FAST") String chargeType,
        @Size(max = 60) String station,
        @Size(max = 200) String note) {
}
