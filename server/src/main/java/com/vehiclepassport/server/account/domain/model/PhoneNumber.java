package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import java.util.regex.Pattern;

public record PhoneNumber(String value) {

    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{6,14}$");

    public PhoneNumber {
        if (value == null || !E164.matcher(value).matches()) {
            throw new ValidationFailedException("phone must be in E.164 format");
        }
    }

    public static PhoneNumber of(String raw) {
        return new PhoneNumber(raw);
    }
}
