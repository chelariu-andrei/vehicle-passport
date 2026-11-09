package com.vehiclepassport.server.scan.api.dto;

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

public record ConfirmScanRequest(
        @Pattern(regexp = "SERVICE|REPAIR|TIRES|ITP") String type,
        String serviceName,
        @NotNull LocalDate date,
        @NotNull @Min(0) Integer odometerKm,
        List<@NotNull @Valid PartRequest> parts,
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal labor,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal total,
        @Pattern(regexp = "[A-Z]{3}") String currency,
        @Size(max = 2000) String notes) {

    public record PartRequest(
            @NotNull String name,
            @NotNull @DecimalMin("0") BigDecimal qty,
            @NotNull @DecimalMin("0") BigDecimal price) {
    }
}
