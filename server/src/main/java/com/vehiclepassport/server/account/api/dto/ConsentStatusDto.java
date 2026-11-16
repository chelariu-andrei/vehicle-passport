package com.vehiclepassport.server.account.api.dto;

public record ConsentStatusDto(boolean required, VersionState terms, VersionState privacy, boolean marketing,
        boolean analytics) {

    public record VersionState(String currentVersion, String acceptedVersion) {
    }
}
