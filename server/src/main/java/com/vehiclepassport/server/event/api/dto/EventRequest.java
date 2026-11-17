package com.vehiclepassport.server.event.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request shape only. Which of odometerKm, customLabel, validFrom, validUntil and details a type needs or forbids
 * is the domain's rule table; a breach answers validation-failed as well. Null components / customFields mean none.
 */
public record EventRequest(
        @NotNull @Pattern(regexp = "SERVICE|REPAIR|TIRES|ITP|ROVINIETA|INSURANCE|SAFETY_EQUIPMENT|OTHER") String type,
        @NotNull LocalDate date,
        @Min(0) Integer odometerKm,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal costAmount,
        @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
        @Size(max = 2000) String notes,
        String customLabel,
        LocalDate validFrom,
        LocalDate validUntil,
        @Valid DetailsDto details,
        List<@NotNull @Pattern(regexp = "ENGINE|TRANSMISSION|BRAKES|SUSPENSION|STEERING|TIRES_WHEELS|ELECTRICAL"
                + "|CLIMATE|BODY|EXHAUST|INTERIOR|FLUIDS|OTHER") String> components,
        @Size(max = 10) List<@NotNull @Valid CustomFieldDto> customFields) {
}
