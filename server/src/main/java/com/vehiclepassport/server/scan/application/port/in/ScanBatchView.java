package com.vehiclepassport.server.scan.application.port.in;

import java.util.List;
import java.util.UUID;

public record ScanBatchView(UUID batchId, List<ScanJobView> jobs) {
}
