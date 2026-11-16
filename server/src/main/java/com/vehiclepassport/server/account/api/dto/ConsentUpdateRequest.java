package com.vehiclepassport.server.account.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ConsentUpdateRequest(
        @Valid List<@NotNull @Valid Acceptance> accept,
        Boolean marketing,
        Boolean analytics,
        @NotBlank String source) {

    public record Acceptance(@NotBlank String type, @NotBlank String version) {
    }
}
