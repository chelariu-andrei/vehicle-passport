package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;

public enum ConsentSource {
    SIGN_UP_FORM("sign-up-form"), SOCIAL_SIGN_UP("social-sign-up"), RE_CONSENT("re-consent"), SETTINGS("settings");

    private final String value;

    ConsentSource(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static ConsentSource fromValue(String value) {
        for (ConsentSource v : values()) {
            if (v.value.equals(value)) {
                return v;
            }
        }
        throw new ValidationFailedException("Unknown consent source: " + value);
    }
}
