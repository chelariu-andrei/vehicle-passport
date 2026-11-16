package com.vehiclepassport.server.account.domain.model;

/** {@code diagnostics} may be null; it is only kept when {@code includeDiagnostics} is true. */
public record SupportReport(SupportKind kind, String message, boolean includeDiagnostics,
        SupportDiagnostics diagnostics) {
}
