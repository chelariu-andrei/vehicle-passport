package com.vehiclepassport.server.scan.application.port.out;

import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.ScanResult;

public interface ReceiptExtractionPort {

    /** @throws ExtractionFailedException when the provider cannot produce a result */
    ScanResult extract(byte[] content, String contentType);
}
