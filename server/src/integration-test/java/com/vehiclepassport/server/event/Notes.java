package com.vehiclepassport.server.event;

final class Notes {

    /** Quotes, backslash, newline, tab, emoji (surrogate pairs) and Romanian diacritics, as escapes. */
    static final String TRICKY = "A spus \"revizie\"\nlinia 2 🚗🔧 ă â î ș ț"
            + " Ă Â Î Ș Ț \\ \t";

    private Notes() {
    }
}
