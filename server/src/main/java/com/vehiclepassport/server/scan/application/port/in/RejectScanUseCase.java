package com.vehiclepassport.server.scan.application.port.in;

import java.util.UUID;

public interface RejectScanUseCase {

    void reject(UUID userId, UUID jobId);
}
