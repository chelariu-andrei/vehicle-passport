package com.vehiclepassport.server.scan.api.dto;

import java.util.List;
import java.util.UUID;

public record ScanJobResponse(UUID id, String status, ScanFieldsResponse fields,
        List<ScanWarningResponse> warnings) {
}
