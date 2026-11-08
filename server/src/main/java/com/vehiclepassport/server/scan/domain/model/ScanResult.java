package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ScanResult(
        ExtractedField<String> serviceName,
        ExtractedField<LocalDate> date,
        ExtractedField<Integer> odometerKm,
        ExtractedField<List<ExtractedPart>> parts,
        ExtractedField<BigDecimal> labor,
        ExtractedField<BigDecimal> total) {
}
