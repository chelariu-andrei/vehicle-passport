package com.vehiclepassport.server.event.domain.model;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Validity status (spec §5.6). The current entry of a group is the one with the latest validFrom, ties broken by
 * createdAt, then id; only it carries a live status, the others are {@link ValidityStatus#SUPERSEDED}. Legacy rows
 * never make it throw: a scanned ITP without typed details is still an ITP, and an INSURANCE or SAFETY_EQUIPMENT row
 * without typed details belongs to no group.
 */
public final class ValidityStatusPolicy {

    /** A current entry ending within this many days of today (inclusive) is {@link ValidityStatus#EXPIRING}. */
    public static final int EXPIRING_DAYS = 30;

    /** The id as a string orders like the Postgres uuid (unsigned bytes), unlike {@link UUID#compareTo}. */
    private static final Comparator<VehicleEvent> RECENCY = Comparator
            .comparing(ValidityStatusPolicy::validFrom)
            .thenComparing(VehicleEvent::createdAt)
            .thenComparing(e -> e.id().toString());

    private ValidityStatusPolicy() {
    }

    public static Optional<ValidityGroup> group(VehicleEvent e) {
        return Optional.ofNullable(switch (e.type()) {
            case ROVINIETA -> ValidityGroup.ROVINIETA;
            case ITP -> ValidityGroup.ITP;
            case INSURANCE -> e.details() instanceof InsuranceDetails i ? switch (i.coverage()) {
                case RCA -> ValidityGroup.RCA;
                case CASCO -> ValidityGroup.CASCO;
            } : null;
            case SAFETY_EQUIPMENT -> e.details() instanceof SafetyEquipmentDetails s ? switch (s.item()) {
                case FIRE_EXTINGUISHER -> ValidityGroup.EXTINGUISHER;
                case FIRST_AID_KIT -> ValidityGroup.FIRST_AID;
            } : null;
            case SERVICE, REPAIR, TIRES, OTHER -> null;
        });
    }

    /** The id of the current entry of each group present in {@code validityEntries}; other events are ignored. */
    public static Set<UUID> currentIds(List<VehicleEvent> validityEntries) {
        Map<ValidityGroup, VehicleEvent> current = new EnumMap<>(ValidityGroup.class);
        for (VehicleEvent e : validityEntries) {
            group(e).ifPresent(g -> current.merge(g, e, (a, b) -> RECENCY.compare(a, b) >= 0 ? a : b));
        }
        Set<UUID> ids = new HashSet<>();
        current.values().forEach(e -> ids.add(e.id()));
        return ids;
    }

    /** Null for an event in no group. */
    public static ValidityStatus status(VehicleEvent e, boolean current, LocalDate today) {
        if (group(e).isEmpty()) {
            return null;
        }
        if (!current) {
            return ValidityStatus.SUPERSEDED;
        }
        LocalDate until = e.validity() == null ? null : e.validity().validUntil();
        if (until == null) {
            return ValidityStatus.UNKNOWN;
        }
        if (today.isAfter(until)) {
            return ValidityStatus.EXPIRED;
        }
        return ChronoUnit.DAYS.between(today, until) <= EXPIRING_DAYS ? ValidityStatus.EXPIRING
                : ValidityStatus.VALID;
    }

    /** For ITP and SAFETY_EQUIPMENT validFrom is the event date; an ITP without validity counts from its date. */
    private static LocalDate validFrom(VehicleEvent e) {
        return e.validity() == null ? e.date() : e.validity().validFrom();
    }
}
