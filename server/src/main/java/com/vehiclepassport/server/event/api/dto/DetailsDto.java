package com.vehiclepassport.server.event.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.util.List;

/**
 * EventDetailsInput / EventDetailsOutput, one flat record discriminated by {@code kind}. Null fields are left out,
 * so each kind serialises to exactly its own shape. On input, a field of another kind, an unknown enum value or
 * SCAN are refused by the application (validation-failed).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DetailsDto(
        @NotNull @Pattern(regexp = "SCAN|INSURANCE|ROVINIETA|ITP|SAFETY_EQUIPMENT") String kind,
        String serviceName,
        List<PartResponse> parts,
        BigDecimal labor,
        @Pattern(regexp = "RCA|CASCO") String coverage,
        String insurer,
        String policyNumber,
        @Pattern(regexp = "ONE_DAY|SEVEN_DAYS|THIRTY_DAYS|NINETY_DAYS|TWELVE_MONTHS") String duration,
        String station,
        @Pattern(regexp = "PASSED|PASSED_WITH_REMARKS|FAILED") String result,
        @Pattern(regexp = "FIRE_EXTINGUISHER|FIRST_AID_KIT") String item) {
}
