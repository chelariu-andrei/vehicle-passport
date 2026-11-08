package com.vehiclepassport.server.vehicle.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVinException;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class VinTest {

    @Test
    void accepts_valid_vin() {
        assertEquals("WVWZZZ1JZXW000001", Vin.of("WVWZZZ1JZXW000001").value());
    }

    @Test
    void normalises_case_and_whitespace() {
        assertEquals("WVWZZZ1JZXW000001", Vin.of("  wvwzzz1jzxw000001 ").value());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "WVWZZZ1JZXW00000",
        "WVWZZZ1JZXW0000011",
        "IVWZZZ1JZXW000001",
        "OVWZZZ1JZXW000001",
        "QVWZZZ1JZXW000001"
    })
    void rejects_invalid_vin(String raw) {
        InvalidVinException e = assertThrows(InvalidVinException.class, () -> Vin.of(raw));
        assertEquals("invalid-vin", e.code());
    }

    @Test
    void rejects_null() {
        assertThrows(InvalidVinException.class, () -> Vin.of(null));
    }
}
