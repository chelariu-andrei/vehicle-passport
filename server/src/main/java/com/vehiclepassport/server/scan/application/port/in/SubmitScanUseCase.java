package com.vehiclepassport.server.scan.application.port.in;

import java.util.UUID;

public interface SubmitScanUseCase {

    ScanJobView submit(UUID userId, String vin, UploadedFile file);
}
