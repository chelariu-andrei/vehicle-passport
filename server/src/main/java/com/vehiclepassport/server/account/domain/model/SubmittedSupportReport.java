package com.vehiclepassport.server.account.domain.model;

import java.time.Instant;

/** A stored support report as the user sent it; {@code diagnostics} is null when they did not opt in. */
public record SubmittedSupportReport(SupportKind kind, String message, SupportDiagnostics diagnostics,
        Instant createdAt) {
}
