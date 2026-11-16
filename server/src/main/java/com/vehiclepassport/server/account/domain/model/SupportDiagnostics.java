package com.vehiclepassport.server.account.domain.model;

/** Technical context the user agreed to send along with a report. */
public record SupportDiagnostics(String appVersion, String platform, String osVersion, String deviceModel) {
}
