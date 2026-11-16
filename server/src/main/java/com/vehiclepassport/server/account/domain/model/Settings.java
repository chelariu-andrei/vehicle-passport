package com.vehiclepassport.server.account.domain.model;

public record Settings(
        Language language,
        Appearance appearance,
        DistanceUnit distance,
        Currency currency,
        NotificationPrefs notifications) {

    public static Settings defaults() {
        return new Settings(Language.SYSTEM, Appearance.SYSTEM, DistanceUnit.KM, Currency.RON,
                NotificationPrefs.defaults());
    }
}
