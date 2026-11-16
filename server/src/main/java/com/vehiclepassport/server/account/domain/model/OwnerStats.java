package com.vehiclepassport.server.account.domain.model;

/** Counts of the records an account owns. */
public record OwnerStats(long vehicles, long events, long passports) {
}
