package com.vehiclepassport.server.event.domain.model;

/**
 * What an event type requires (spec §5.1).
 *
 * @param detailsKind the only details kind the type takes, or null when it takes none
 */
public record TypeRule(OdometerRule odometer, ValidityRule validity, DetailsKind detailsKind,
        boolean detailsRequired, boolean customLabelRequired) {

    public enum OdometerRule { REQUIRED, OPTIONAL }

    /**
     * NONE: no validity. UNTIL_OPTIONAL / UNTIL_REQUIRED: the client sends only validUntil, validFrom is the event
     * date. COMPUTED: the client sends validFrom, validUntil comes from the details. RANGE: the client sends both.
     */
    public enum ValidityRule { NONE, UNTIL_OPTIONAL, UNTIL_REQUIRED, COMPUTED, RANGE }
}