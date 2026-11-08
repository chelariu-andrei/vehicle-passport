package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Business checks on an extracted receipt. A check whose inputs are null is skipped. */
public final class ReceiptValidator {

    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    private ReceiptValidator() {
    }

    public static List<ScanWarning> validate(ScanResult r, LocalDate today, boolean odometerConsistent) {
        List<ScanWarning> warnings = new ArrayList<>();
        if (totalMismatch(r)) {
            warnings.add(ScanWarning.TOTAL_MISMATCH);
        }
        if (!odometerConsistent) {
            warnings.add(ScanWarning.ODOMETER_INCONSISTENT);
        }
        if (dateInFuture(r, today)) {
            warnings.add(ScanWarning.DATE_IN_FUTURE);
        }
        return List.copyOf(warnings);
    }

    private static boolean totalMismatch(ScanResult r) {
        List<ExtractedPart> parts = value(r.parts());
        BigDecimal labor = value(r.labor());
        BigDecimal total = value(r.total());
        if (parts == null || labor == null || total == null) {
            return false;
        }
        BigDecimal sum = labor;
        for (ExtractedPart part : parts) {
            if (part.price() == null) {
                return false;
            }
            sum = sum.add(part.price());
        }
        return sum.subtract(total).abs().compareTo(TOLERANCE) > 0;
    }

    private static boolean dateInFuture(ScanResult r, LocalDate today) {
        LocalDate date = value(r.date());
        return today != null && date != null && date.isAfter(today);
    }

    private static <T> T value(ExtractedField<T> field) {
        return field == null ? null : field.value();
    }
}
