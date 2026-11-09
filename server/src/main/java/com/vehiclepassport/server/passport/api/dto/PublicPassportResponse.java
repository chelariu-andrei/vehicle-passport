package com.vehiclepassport.server.passport.api.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;

/** The snapshot is written exactly as stored, so the served bytes are the bytes that were hashed. */
public record PublicPassportResponse(@JsonRawValue String snapshot, String hash, String algorithm) {

    public static final String SHA_256 = "SHA-256";
}
