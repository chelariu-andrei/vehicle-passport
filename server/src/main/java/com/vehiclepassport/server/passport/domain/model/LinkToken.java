package com.vehiclepassport.server.passport.domain.model;

import java.security.SecureRandom;
import java.util.Base64;

public final class LinkToken {

    private LinkToken() {}

    public static String generate(SecureRandom random) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
