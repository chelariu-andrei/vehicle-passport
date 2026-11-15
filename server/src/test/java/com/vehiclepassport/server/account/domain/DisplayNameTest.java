package com.vehiclepassport.server.account.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.DisplayName;
import org.junit.jupiter.api.Test;

class DisplayNameTest {

    @Test
    void displayNameRejectsBlankAndControlChars() {
        assertThrows(ValidationFailedException.class, () -> DisplayName.of("   "));
        assertThrows(ValidationFailedException.class, () -> DisplayName.of(""));
        assertThrows(ValidationFailedException.class, () -> DisplayName.of("a\nb"));
        assertThrows(ValidationFailedException.class, () -> DisplayName.of("a\u007Fb"));
        assertThrows(ValidationFailedException.class, () -> DisplayName.of("x".repeat(81)));
        assertEquals(80, DisplayName.of("x".repeat(80)).value().length());
    }

    @Test
    void displayNameTrims() {
        assertEquals("Ana Pop", DisplayName.of("  Ana Pop  ").value());
    }
}
