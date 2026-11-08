package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import org.junit.jupiter.api.Test;

class ExtractedFieldTest {

    @Test
    void confidence_1_1_throws() {
        assertThrows(IllegalArgumentException.class, () -> new ExtractedField<>("x", 1.1));
    }

    @Test
    void confidence_minus_0_1_throws() {
        assertThrows(IllegalArgumentException.class, () -> new ExtractedField<>("x", -0.1));
    }

    @Test
    void confidence_bounds_are_accepted() {
        assertDoesNotThrow(() -> new ExtractedField<>("x", 0.0));
        assertDoesNotThrow(() -> new ExtractedField<>("x", 1.0));
    }
}
