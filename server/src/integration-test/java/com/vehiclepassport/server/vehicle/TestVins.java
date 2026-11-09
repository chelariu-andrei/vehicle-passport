package com.vehiclepassport.server.vehicle;

import java.util.concurrent.ThreadLocalRandom;

final class TestVins {

    private static final String ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

    private TestVins() {
    }

    static String random() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(ALPHABET.charAt(r.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
