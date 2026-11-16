package com.vehiclepassport.server.account.api.dto;

public record LegalDocumentSummaryDto(String type, String version, String locale, String title,
        String effectiveDate) {
}
