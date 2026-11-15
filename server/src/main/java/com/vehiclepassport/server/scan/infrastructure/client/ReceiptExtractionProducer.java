package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.shared.config.ScanConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import java.net.URI;

/** Chooses the extraction adapter at runtime from {@code scan.extraction.provider} (default: none). */
@ApplicationScoped
public class ReceiptExtractionProducer {

    private final ScanConfig config;

    @Inject
    public ReceiptExtractionProducer(ScanConfig config) {
        this.config = config;
    }

    @Produces
    @ApplicationScoped
    public ReceiptExtractionPort port() {
        if ("paddle".equalsIgnoreCase(config.extraction().provider())) {
            var ocr = config.ocr();
            return new PaddleOcrExtractionAdapter(new OcrHttpClient(URI.create(ocr.baseUrl()), ocr.timeout()));
        }
        return new NoProviderExtractionAdapter();
    }
}
