package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.ReceiptExtraction;
import jakarta.enterprise.context.ApplicationScoped;

/** No extraction provider is wired yet (D7): every attempt fails, so jobs end FAILED after the retries. */
@ApplicationScoped
public class NoProviderExtractionAdapter implements ReceiptExtractionPort {

    @Override
    public ReceiptExtraction extract(byte[] content, String contentType) {
        throw new ExtractionFailedException("no extraction provider configured");
    }
}
