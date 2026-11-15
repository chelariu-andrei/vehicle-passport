package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.ReceiptExtraction;

/** No extraction provider is wired yet (D7): every attempt fails, so jobs end FAILED after the retries. */
public class NoProviderExtractionAdapter implements ReceiptExtractionPort {

    @Override
    public ReceiptExtraction extract(byte[] content, String contentType) {
        throw new ExtractionFailedException("no extraction provider configured");
    }
}
