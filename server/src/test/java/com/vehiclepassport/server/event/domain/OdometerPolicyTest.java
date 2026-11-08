package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.OdometerInconsistentException;
import com.vehiclepassport.server.event.domain.model.OdometerPolicy;
import org.junit.jupiter.api.Test;

class OdometerPolicyTest {

    @Test
    void open_bounds_pass() {
        assertDoesNotThrow(() -> OdometerPolicy.check(null, 5, null));
        assertDoesNotThrow(() -> OdometerPolicy.check(null, 5, 10));
        assertDoesNotThrow(() -> OdometerPolicy.check(1, 5, null));
    }

    @Test
    void equal_values_pass() {
        assertDoesNotThrow(() -> OdometerPolicy.check(5, 5, 5));
    }

    @Test
    void below_previous_fails() {
        OdometerInconsistentException e =
                assertThrows(OdometerInconsistentException.class, () -> OdometerPolicy.check(120000, 90000, null));
        assertEquals("odometer-inconsistent", e.code());
    }

    @Test
    void above_next_fails() {
        assertThrows(OdometerInconsistentException.class, () -> OdometerPolicy.check(100, 130, 120));
    }
}
