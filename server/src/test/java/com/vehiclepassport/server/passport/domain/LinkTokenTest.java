package com.vehiclepassport.server.passport.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.domain.model.LinkToken;
import java.security.SecureRandom;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class LinkTokenTest {

    private final SecureRandom random = new SecureRandom();

    @Test
    void token_decodes_to_32_bytes() {
        assertEquals(32, Base64.getUrlDecoder().decode(LinkToken.generate(random)).length);
    }

    @Test
    void url_safe_charset() {
        for (int i = 0; i < 50; i++) {
            assertTrue(LinkToken.generate(random).matches("[A-Za-z0-9_-]{43}"));
        }
    }

    @Test
    void two_tokens_differ() {
        assertNotEquals(LinkToken.generate(random), LinkToken.generate(random));
    }
}
