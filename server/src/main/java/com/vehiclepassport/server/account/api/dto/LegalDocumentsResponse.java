package com.vehiclepassport.server.account.api.dto;

import java.util.List;

public record LegalDocumentsResponse(List<LegalDocumentSummaryDto> documents) {
}
