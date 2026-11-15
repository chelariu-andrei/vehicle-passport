package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.util.List;

/** What an extraction provider returns: the fields, the VAT amount beside them (nullable) and its own warnings. */
public record ReceiptExtraction(ScanResult result, BigDecimal vat, List<ScanWarning> warnings) {

    public ReceiptExtraction {
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }

    public static ReceiptExtraction of(ScanResult result) {
        return new ReceiptExtraction(result, null, List.of());
    }
}
