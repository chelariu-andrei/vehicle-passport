package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.shared.config.ScanConfig;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.net.URI;

/** Chooses the extraction adapter at runtime from {@code scan.extraction.provider} (default: none). */
@ApplicationScoped
public class ReceiptExtractionProducer {

    private final ScanConfig config;

    @Inject
    public ReceiptExtractionProducer(ScanConfig config) {
        this.config = config;
    }

    /** Singleton, and created at startup below, so a bad OCR config stops the app instead of failing every job. */
    @Produces
    @Singleton
    public ReceiptExtractionPort port() {
        if ("paddle".equalsIgnoreCase(config.extraction().provider())) {
            var ocr = config.ocr();
            URI base;
            try {
                base = URI.create(ocr.baseUrl());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("scan.ocr.base-url must be an http(s) URL with a host");
            }
            return new PaddleOcrExtractionAdapter(new OcrHttpClient(base, ocr.timeout()));
        }
        return new NoProviderExtractionAdapter();
    }

    void createAtStartup(@Observes StartupEvent event, ReceiptExtractionPort port) {
        // injecting the singleton port forces its creation (and the config validation) now
    }
}
