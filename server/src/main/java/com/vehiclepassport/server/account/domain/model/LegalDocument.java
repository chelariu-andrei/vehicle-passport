package com.vehiclepassport.server.account.domain.model;

import java.time.LocalDate;

public record LegalDocument(
        LegalDocumentType type,
        String version,
        String locale,
        String title,
        String bodyMarkdown,
        LocalDate effectiveDate) {
}
