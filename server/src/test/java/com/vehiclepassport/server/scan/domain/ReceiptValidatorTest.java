package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ReceiptValidator;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReceiptValidatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private static final double HIGH = 0.95;

    private static ExtractedPart part(String price) {
        return new ExtractedPart("filter", BigDecimal.ONE, new BigDecimal(price));
    }

    private static ExtractedField<List<ExtractedPart>> parts(String... prices) {
        List<ExtractedPart> list = new java.util.ArrayList<>();
        for (String p : prices) {
            list.add(part(p));
        }
        return new ExtractedField<>(list, HIGH);
    }

    private static ExtractedField<BigDecimal> money(String amount) {
        return new ExtractedField<>(new BigDecimal(amount), HIGH);
    }

    /** Receipt with a past date and a plausible odometer; the parts, labor and total are caller-supplied. */
    private static ScanResult receipt(ExtractedField<List<ExtractedPart>> parts,
            ExtractedField<BigDecimal> labor, ExtractedField<BigDecimal> total) {
        return new ScanResult(
                new ExtractedField<>("Service Centre", HIGH),
                new ExtractedField<>(LocalDate.of(2026, 10, 1), HIGH),
                new ExtractedField<>(52_000, HIGH),
                parts,
                labor,
                total);
    }

    @Test
    void parts_300_labor_100_total_500_warns_TOTAL_MISMATCH() {
        ScanResult r = receipt(parts("300"), money("100"), money("500"));

        assertEquals(List.of(ScanWarning.TOTAL_MISMATCH), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void parts_300_labor_100_total_400_clean() {
        ScanResult r = receipt(parts("300"), money("100"), money("400"));

        assertEquals(List.of(), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void difference_of_exactly_0_01_is_clean() {
        ScanResult r = receipt(parts("300"), money("100"), money("400.01"));

        assertEquals(List.of(), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void difference_of_0_02_warns() {
        ScanResult r = receipt(parts("300"), money("100"), money("400.02"));

        assertEquals(List.of(ScanWarning.TOTAL_MISMATCH), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void future_date_warns() {
        ScanResult r = new ScanResult(null,
                new ExtractedField<>(TODAY.plusDays(1), HIGH), null, null, null, null);

        assertEquals(List.of(ScanWarning.DATE_IN_FUTURE), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void date_equal_to_today_is_clean() {
        ScanResult r = new ScanResult(null,
                new ExtractedField<>(TODAY, HIGH), null, null, null, null);

        assertEquals(List.of(), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void inconsistent_odometer_warns() {
        ScanResult r = receipt(parts("300"), money("100"), money("400"));

        assertEquals(List.of(ScanWarning.ODOMETER_INCONSISTENT), ReceiptValidator.validate(r, TODAY, false));
    }

    @Test
    void null_total_skips_sum_check() {
        ScanResult r = receipt(parts("300"), money("100"), null);

        assertEquals(List.of(), ReceiptValidator.validate(r, TODAY, true));
    }

    @Test
    void low_confidence_adds_no_warning() {
        ExtractedField<List<ExtractedPart>> lowParts = new ExtractedField<>(List.of(part("300")), 0.2);
        ExtractedField<BigDecimal> lowLabor = new ExtractedField<>(new BigDecimal("100"), 0.2);
        ExtractedField<BigDecimal> lowTotal = new ExtractedField<>(new BigDecimal("400"), 0.2);
        ScanResult r = receipt(lowParts, lowLabor, lowTotal);

        assertEquals(List.of(), ReceiptValidator.validate(r, TODAY, true));
    }
}
