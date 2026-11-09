package com.vehiclepassport.server.scan.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ScanFieldsResponse(ScanFieldResponse serviceName, ScanFieldResponse date,
        ScanFieldResponse odometerKm, ScanFieldResponse parts, ScanFieldResponse labor,
        ScanFieldResponse total) {
}
