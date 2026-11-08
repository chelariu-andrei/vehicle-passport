package com.vehiclepassport.server.passport.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.domain.model.PublicLink;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PublicLinkTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    @Test
    void open_without_expiry() {
        assertTrue(new PublicLink("t", null, null).isOpen(NOW));
    }

    @Test
    void closed_at_exact_expiry_instant() {
        assertFalse(new PublicLink("t", NOW, null).isOpen(NOW));
    }

    @Test
    void open_one_nano_before() {
        assertTrue(new PublicLink("t", NOW, null).isOpen(NOW.minusNanos(1)));
    }

    @Test
    void revoke_is_idempotent_keeping_first_time() {
        PublicLink first = new PublicLink("t", null, null).revoke(NOW);
        PublicLink second = first.revoke(NOW.plusSeconds(60));
        assertEquals(NOW, second.revokedAt());
        assertFalse(second.isOpen(NOW));
    }
}
