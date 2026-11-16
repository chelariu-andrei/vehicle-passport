package com.vehiclepassport.server.account.api.dto;

public record LegalDocumentDto(String type, String version, String locale, String title, String bodyMarkdown,
        String effectiveDate) {
}
