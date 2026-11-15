package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.scan.domain.model.OcrValues;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class OcrValuesTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "1.234,56|1234.56", "1 234,56|1234.56", "1234.56|1234.56", "1234,5|1234.5", "1.234|1234", "350|350",
        "1.234.567,89|1234567.89", "1.234,56 lei|1234.56", "1.234,56 RON|1234.56", "1O0,50|100.50",
        "l.234,56|1234.56"})
    void money_reads(String in, String expected) {
        assertEquals(0, new BigDecimal(expected).compareTo(OcrValues.money(in).orElseThrow()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1,234", "1.2345", "12.34.56", "abc", "lO", "O", "", "19%", "-5,00", "1.234,S6"})
    void money_stays_empty(String in) {
        assertTrue(OcrValues.money(in).isEmpty());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"123.456|123456", "123 456|123456", "123456|123456", "1.234|1234"})
    void km_reads(String in, int expected) {
        assertEquals(expected, OcrValues.km(in).orElseThrow());
    }

    @ParameterizedTest
    @ValueSource(strings = {"123,5", "99999999999", "12.34", "km"})
    void km_stays_empty(String in) {
        assertTrue(OcrValues.km(in).isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"15.03.2026", "15/03/2026", "15-03-2026", "din data 15.03.2026"})
    void date_reads(String in) {
        assertEquals(LocalDate.of(2026, 3, 15), OcrValues.date(in).orElseThrow());
    }

    @ParameterizedTest
    @ValueSource(strings = {"31.02.2026", "15.03.26", "15.03/2026", "2026"})
    void date_stays_empty(String in) {
        assertTrue(OcrValues.date(in).isEmpty());
    }
}
