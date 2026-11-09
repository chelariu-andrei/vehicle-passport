package com.vehiclepassport.server.passport;

import java.util.concurrent.ThreadLocalRandom;

final class PassportFixtures {

    /** Quotes, backslash, newline, tab, emoji (surrogate pairs) and Romanian diacritics. */
    static final String TRICKY_NOTES = "A spus \"revizie\"\nlinia 2 😀 🚗 ă â î ș ț Ă Â Î Ș Ț \\ \t";

    private static final String ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

    private PassportFixtures() {
    }

    static String randomVin() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(ALPHABET.charAt(r.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
