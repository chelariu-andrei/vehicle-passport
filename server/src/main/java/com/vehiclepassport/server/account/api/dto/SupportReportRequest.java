package com.vehiclepassport.server.account.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SupportReportRequest(
        @NotBlank String kind,
        @NotNull @Size(min = 10, max = 4000) String message,
        @NotNull Boolean includeDiagnostics,
        @Valid Diagnostics diagnostics) {

    public record Diagnostics(
            @NotNull @Size(max = 40) String appVersion,
            @NotNull @Size(max = 40) String platform,
            @NotNull @Size(max = 40) String osVersion,
            @NotNull @Size(max = 100) String deviceModel) {
    }
}
