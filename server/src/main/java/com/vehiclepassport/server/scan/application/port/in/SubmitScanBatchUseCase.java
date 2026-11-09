package com.vehiclepassport.server.scan.application.port.in;

import java.util.List;
import java.util.UUID;

public interface SubmitScanBatchUseCase {

    ScanBatchView submit(UUID userId, String vin, List<UploadedFile> files);
}
