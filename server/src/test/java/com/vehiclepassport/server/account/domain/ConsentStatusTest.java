package com.vehiclepassport.server.account.domain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import org.junit.jupiter.api.Test;

class ConsentStatusTest {

    @Test
    void consentRequiredWhenAcceptedVersionIsOlder() {
        assertTrue(ConsentStatus.of("2", "1", "1", "1", false, false).required());
        assertTrue(ConsentStatus.of("1", "2", "1", null, false, false).required());
    }

    @Test
    void consentNotRequiredWhenBothCurrent() {
        ConsentStatus s = ConsentStatus.of("2", "3", "2", "3", true, false);
        assertFalse(s.required());
        assertTrue(s.marketing());
    }
}
