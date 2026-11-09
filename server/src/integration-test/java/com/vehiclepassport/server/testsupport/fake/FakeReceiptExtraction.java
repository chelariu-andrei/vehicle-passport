package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.scan.application.port.out.ReceiptExtractionPort;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Alternative
@ApplicationScoped
public class FakeReceiptExtraction implements ReceiptExtractionPort, Resettable {

    private ScanResult result = defaultResult();
    private int failuresLeft;
    private int calls;

    /** A consistent receipt: parts 300 + labor 100 = total 400. */
    public static ScanResult defaultResult() {
        return new ScanResult(
            new ExtractedField<>("Auto Service SRL", 0.95),
            new ExtractedField<>(LocalDate.of(2025, 6, 1), 0.9),
            new ExtractedField<>(120000, 0.8),
            new ExtractedField<>(
                List.of(new ExtractedPart("Oil filter", BigDecimal.ONE, new BigDecimal("300"))), 0.85),
            new ExtractedField<>(new BigDecimal("100"), 0.7),
            new ExtractedField<>(new BigDecimal("400"), 0.9));
    }

    public void willReturn(ScanResult next) {
        this.result = next;
    }

    public void willFail(int times) {
        this.failuresLeft = times;
    }

    public int calls() {
        return calls;
    }

    @Override
    public ScanResult extract(byte[] content, String contentType) {
        calls++;
        if (failuresLeft > 0) {
            failuresLeft--;
            throw new ExtractionFailedException("provider unavailable");
        }
        return result;
    }

    @Override
    public void reset() {
        result = defaultResult();
        failuresLeft = 0;
        calls = 0;
    }
}
