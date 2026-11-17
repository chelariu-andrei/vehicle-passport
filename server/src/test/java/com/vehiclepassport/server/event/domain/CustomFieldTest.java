package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.CustomField;
import org.junit.jupiter.api.Test;

class CustomFieldTest {

    @Test
    void label_and_value_are_trimmed() {
        CustomField f = new CustomField("  Layers ", " 3 ");
        assertEquals("Layers", f.label());
        assertEquals("3", f.value());
    }

    @Test
    void blank_label_refused() {
        assertThrows(InvalidEventException.class, () -> new CustomField("   ", "x"));
        assertThrows(InvalidEventException.class, () -> new CustomField(null, "x"));
    }

    @Test
    void label_of_41_chars_refused() {
        assertThrows(InvalidEventException.class, () -> new CustomField("a".repeat(41), "x"));
        assertEquals(40, new CustomField("a".repeat(40), "x").label().length());
    }

    @Test
    void value_of_201_chars_refused() {
        assertThrows(InvalidEventException.class, () -> new CustomField("L", "v".repeat(201)));
        assertEquals(200, new CustomField("L", "v".repeat(200)).value().length());
    }

    @Test
    void blank_value_refused() {
        assertThrows(InvalidEventException.class, () -> new CustomField("L", "  "));
    }
}
