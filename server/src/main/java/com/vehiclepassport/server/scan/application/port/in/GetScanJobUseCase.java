package com.vehiclepassport.server.scan.application.port.in;

import java.util.UUID;

public interface GetScanJobUseCase {

    ScanJobView get(UUID userId, UUID jobId);
}
