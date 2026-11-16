package com.vehiclepassport.server.account.domain.model;

import java.util.Objects;

public record ConsentStatus(VersionState terms, VersionState privacy, boolean marketing, boolean analytics) {

    public record VersionState(String currentVersion, String acceptedVersion) {

        public boolean isCurrentAccepted() {
            return Objects.equals(currentVersion, acceptedVersion);
        }
    }

    public static ConsentStatus of(
            String currentTerms,
            String currentPrivacy,
            String lastAcceptedTerms,
            String lastAcceptedPrivacy,
            boolean marketing,
            boolean analytics) {
        return new ConsentStatus(
                new VersionState(currentTerms, lastAcceptedTerms),
                new VersionState(currentPrivacy, lastAcceptedPrivacy),
                marketing,
                analytics);
    }

    public boolean required() {
        return !terms.isCurrentAccepted() || !privacy.isCurrentAccepted();
    }
}
