package com.vehiclepassport.server.account.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.PhoneNumber;
import org.junit.jupiter.api.Test;

class PhoneNumberTest {

    @Test
    void phoneRejectsSpacesAndDashes() {
        assertThrows(ValidationFailedException.class, () -> PhoneNumber.of("+40 721 234 567"));
        assertThrows(ValidationFailedException.class, () -> PhoneNumber.of("+40-721-234-567"));
        assertThrows(ValidationFailedException.class, () -> PhoneNumber.of("0721234567"));
    }

    @Test
    void phoneAcceptsE164() {
        assertEquals("+40721234567", PhoneNumber.of("+40721234567").value());
    }
}
