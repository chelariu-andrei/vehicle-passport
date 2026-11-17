package com.vehiclepassport.server.passport.domain.model;

/**
 * The non-scan details of an event, flattened like the API: kind (INSURANCE, ROVINIETA, ITP, SAFETY_EQUIPMENT) says
 * which of the other fields are set. Scan details never use this; they stay flat on the event.
 */
public record SnapshotDetails(String kind, String coverage, String insurer, String policyNumber, String duration,
        String station, String result, String item) {}
