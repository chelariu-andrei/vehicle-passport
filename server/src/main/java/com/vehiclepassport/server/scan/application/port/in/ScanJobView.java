package com.vehiclepassport.server.scan.application.port.in;

import com.vehiclepassport.server.scan.domain.model.ScanResult;
import java.util.List;
import java.util.UUID;

public record ScanJobView(UUID id, String status, ScanResult result, List<String> warnings) {
}
