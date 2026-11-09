package com.vehiclepassport.server.scan.application.port.in;

import java.util.UUID;

public interface ConfirmScanUseCase {

    /** Saves the corrected data as a DOCUMENTED event and returns its id. */
    UUID confirm(ConfirmScanCommand command);
}
