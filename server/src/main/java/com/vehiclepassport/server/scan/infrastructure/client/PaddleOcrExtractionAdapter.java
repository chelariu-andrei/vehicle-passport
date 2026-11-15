package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.OcrDocument;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import com.vehiclepassport.server.scan.domain.model.ReceiptExtraction;
import com.vehiclepassport.server.scan.domain.model.ReceiptParser;
import java.util.Locale;
import org.jboss.logging.Logger;

/** Reads an image through the OCR service, then parses its lines with the deterministic {@link ReceiptParser}. */
public class PaddleOcrExtractionAdapter implements ReceiptExtractionPort {

    private static final Logger LOG = Logger.getLogger(PaddleOcrExtractionAdapter.class);

    private final OcrHttpClient client;

    public PaddleOcrExtractionAdapter(OcrHttpClient client) {
        this.client = client;
    }

    @Override
    public ReceiptExtraction extract(byte[] content, String contentType) {
        // PDFs pass upload admission but OCR cannot read them (plan P7): fail without calling the service.
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ExtractionFailedException("only images can be read");
        }
        OcrDocument document = client.recognize(content, contentType);
        if (document.lines().isEmpty()) {
            throw new ExtractionFailedException("no text found");
        }
        double min = document.lines().stream().mapToDouble(OcrLine::score).min().orElse(0.0);
        LOG.infof("OCR returned %d lines, minimum score %.2f", document.lines().size(), min);
        try {
            return ReceiptParser.parse(document);
        } catch (RuntimeException e) {
            throw new ExtractionFailedException("receipt parsing failed");
        }
    }
}
