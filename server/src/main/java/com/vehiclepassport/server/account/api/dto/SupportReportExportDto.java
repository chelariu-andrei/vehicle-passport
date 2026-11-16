package com.vehiclepassport.server.account.api.dto;

import java.time.Instant;

/** One support report in the data export; {@code diagnostics} is null when the user did not send any. */
public record SupportReportExportDto(
        String kind,
        String message,
        SupportReportRequest.Diagnostics diagnostics,
        Instant createdAt) {
}
