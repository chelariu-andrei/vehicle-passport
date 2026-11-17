package com.vehiclepassport.server.account.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** Body and response of /me/settings. Unknown properties are rejected (also globally via quarkus.jackson). */
@JsonIgnoreProperties(ignoreUnknown = false)
public record SettingsDto(
        @NotNull String language,
        @NotNull String appearance,
        @NotNull @Valid Units units,
        @NotNull @Valid Notifications notifications) {

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Units(@NotNull String distance, @NotNull String currency) {
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Notifications(
            @NotNull Boolean documentDeadlines,
            @NotNull List<Integer> reminderDays,
            @NotNull Boolean tireSeason,
            @NotNull Boolean activityScans,
            @NotNull Boolean activityPassportViews,
            @NotNull Boolean activityTransfers,
            @NotNull Boolean productNews) {
    }
}
