package com.vehiclepassport.server.vehicle.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import com.vehiclepassport.server.vehicle.domain.model.Plate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PlateTest {

    @ParameterizedTest
    @ValueSource(strings = {"B 123 ABC", "CJ-45-DUS", "A", "AB12CD34EF", "B  1"})
    void accepts_plates_matching_the_contract(String raw) {
        assertEquals(raw, new Plate(raw).value());
    }

    @ParameterizedTest
    @ValueSource(strings = {"b 123", "ABCDEFGHIJK", " B1", "B1 ", "-B1", "B1-", "", "B_1"})
    void rejects_without_echoing_the_value(String raw) {
        InvalidVehicleDataException e = assertThrows(InvalidVehicleDataException.class, () -> new Plate(raw));
        assertEquals("invalid-vehicle", e.code());
        if (!raw.isBlank()) {
            assertFalse(e.getMessage().contains(raw.trim()));
        }
    }

    @Test
    void rejects_null() {
        assertThrows(InvalidVehicleDataException.class, () -> new Plate(null));
    }

    @Test
    void ofNullable_null_is_null() {
        assertNull(Plate.ofNullable(null));
    }

    @Test
    void ofNullable_wraps_a_value() {
        assertEquals("B 123 ABC", Plate.ofNullable("B 123 ABC").value());
    }
}
