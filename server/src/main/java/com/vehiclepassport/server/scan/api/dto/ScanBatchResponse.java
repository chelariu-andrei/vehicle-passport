package com.vehiclepassport.server.scan.api.dto;

import java.util.List;

public record ScanBatchResponse(List<ScanJobResponse> jobs) {
}
