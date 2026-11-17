package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.DocumentedEventImmutableException;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.TypeRule.OdometerRule;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * An entry on a vehicle's timeline. The per-type rules (spec §5.1) are enforced when an event is created or edited;
 * the canonical constructor only normalises, so rows written under older rules still load. A breach of the type
 * table is a {@link InvalidEventException#validation validation} failure; the older value rules (future date,
 * negative km or cost, currency) stay business-rule failures.
 *
 * @param odometerKm null only for a type whose odometer is optional
 * @param validity   null for a type without validity, and for an ITP without validUntil
 * @param components sorted in declaration order, unmodifiable
 */
public record VehicleEvent(
        UUID id,
        String vin,
        EventType type,
        LocalDate date,
        Integer odometerKm,
        BigDecimal costAmount,
        String currency,
        String customLabel,
        String notes,
        Validity validity,
        EventDetails details,
        Set<Component> components,
        List<CustomField> customFields,
        EvidenceLevel evidence,
        EventSource source,
        UUID createdBy,
        UUID periodId,
        String documentKey,
        Instant createdAt,
        Instant deletedAt) {

    private static final Pattern CURRENCY = Pattern.compile("[A-Z]{3}");
    private static final int MAX_LABEL = 60;
    private static final int MAX_CUSTOM_FIELDS = 10;

    public VehicleEvent {
        components = sorted(components);
        customFields = customFields == null ? List.of() : List.copyOf(customFields);
    }

    /** A manually entered event: no document, confirmed by the user. Scan details are refused. */
    public static VehicleEvent manual(String vin, EventFacts f, EventAnnotations a, UUID createdBy, UUID periodId,
            Clock clock) {
        Checked c = check(f, a, false, clock);
        return new VehicleEvent(UUID.randomUUID(), vin, f.type(), f.date(), f.odometerKm(), f.costAmount(),
                c.currency(), c.customLabel(), a.notes(), c.validity(), f.details(), a.components(),
                a.customFields(), EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, createdBy, periodId, null,
                clock.instant(), null);
    }

    /**
     * An event extracted from a scanned document and confirmed by the user: backed by the document, which is
     * kept as the event's SCAN_SOURCE attachment. The legacy document key is never written any more.
     * A type without a details kind takes {@link ScanDetails} or none; an ITP takes {@link ItpDetails}.
     */
    public static VehicleEvent documented(String vin, EventFacts f, EventAnnotations a, UUID createdBy,
            UUID periodId, Clock clock) {
        Checked c = check(f, a, true, clock);
        return new VehicleEvent(UUID.randomUUID(), vin, f.type(), f.date(), f.odometerKm(), f.costAmount(),
                c.currency(), c.customLabel(), a.notes(), c.validity(), f.details(), a.components(),
                a.customFields(), EvidenceLevel.DOCUMENTED, EventSource.SCAN, createdBy, periodId, null,
                clock.instant(), null);
    }

    /**
     * The event after an edit. Identity, creation time, document, source and evidence are kept. A documented event
     * keeps its facts: any change to them is refused, and only the annotations apply.
     */
    public VehicleEvent edited(EventFacts f, EventAnnotations a, Clock clock) {
        if (evidence.isAtLeast(EvidenceLevel.DOCUMENTED)) {
            if (!sameFacts(f)) {
                throw new DocumentedEventImmutableException(
                        "Only the notes, components and custom fields of a documented event can be changed");
            }
            checkAnnotations(a);
            return new VehicleEvent(id, vin, type, date, odometerKm, costAmount, currency, customLabel, a.notes(),
                    validity, details, a.components(), a.customFields(), evidence, source, createdBy, periodId,
                    documentKey, createdAt, deletedAt);
        }
        Checked c = check(f, a, source == EventSource.SCAN, clock);
        return new VehicleEvent(id, vin, f.type(), f.date(), f.odometerKm(), f.costAmount(), c.currency(),
                c.customLabel(), a.notes(), c.validity(), f.details(), a.components(), a.customFields(), evidence,
                source, createdBy, periodId, documentKey, createdAt, deletedAt);
    }

    public VehicleEvent deleted(Instant when) {
        return new VehicleEvent(id, vin, type, date, odometerKm, costAmount, currency, customLabel, notes, validity,
                details, components, customFields, evidence, source, createdBy, periodId, documentKey, createdAt,
                when);
    }

    /** The facts as the client would state them for this event (the inverse of the validity rule). */
    public EventFacts facts() {
        LocalDate from = validity == null ? null : validity.validFrom();
        LocalDate until = validity == null ? null : validity.validUntil();
        return switch (type.rule().validity()) {
            case NONE -> new EventFacts(type, date, odometerKm, costAmount, currency, customLabel, null, null,
                    details);
            case UNTIL_OPTIONAL, UNTIL_REQUIRED -> new EventFacts(type, date, odometerKm, costAmount, currency,
                    customLabel, null, until, details);
            case COMPUTED -> new EventFacts(type, date, odometerKm, costAmount, currency, customLabel, from, null,
                    details);
            case RANGE -> new EventFacts(type, date, odometerKm, costAmount, currency, customLabel, from, until,
                    details);
        };
    }

    private boolean sameFacts(EventFacts f) {
        EventFacts now = facts();
        return f.type() == now.type()
                && Objects.equals(f.date(), now.date())
                && Objects.equals(f.odometerKm(), now.odometerKm())
                && f.costAmount() != null && now.costAmount() != null
                && f.costAmount().compareTo(now.costAmount()) == 0
                && Objects.equals(normaliseCurrency(f.currency()), now.currency())
                && Objects.equals(trimToNull(f.customLabel()), now.customLabel())
                && Objects.equals(f.validFrom(), now.validFrom())
                && Objects.equals(f.validUntil(), now.validUntil())
                && sameDetails(f.details(), now.details());
    }

    /** Scan amounts compare by value, so 100 and 100.00 are the same labor. */
    private static boolean sameDetails(EventDetails a, EventDetails b) {
        if (a instanceof ScanDetails x && b instanceof ScanDetails y) {
            if (!Objects.equals(x.serviceName(), y.serviceName()) || !sameAmount(x.labor(), y.labor())
                    || x.parts().size() != y.parts().size()) {
                return false;
            }
            for (int i = 0; i < x.parts().size(); i++) {
                PartLine p = x.parts().get(i);
                PartLine q = y.parts().get(i);
                if (!Objects.equals(p.name(), q.name()) || !sameAmount(p.qty(), q.qty())
                        || !sameAmount(p.price(), q.price())) {
                    return false;
                }
            }
            return true;
        }
        return Objects.equals(a, b);
    }

    private static boolean sameAmount(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private record Checked(String currency, String customLabel, Validity validity) {
    }

    private static Checked check(EventFacts f, EventAnnotations a, boolean fromScan, Clock clock) {
        EventType type = f.type();
        if (type == null) {
            throw InvalidEventException.validation("Event type is required");
        }
        TypeRule rule = type.rule();
        if (f.date() == null) {
            throw InvalidEventException.validation("Event date is required");
        }
        if (f.date().isAfter(LocalDate.now(clock))) {
            throw new InvalidEventException("Event date cannot be in the future");
        }
        if (f.odometerKm() == null && rule.odometer() == OdometerRule.REQUIRED) {
            throw InvalidEventException.validation("Odometer is required for " + type);
        }
        if (f.odometerKm() != null && f.odometerKm() < 0) {
            throw new InvalidEventException("Odometer cannot be negative");
        }
        if (f.costAmount() == null) {
            throw new InvalidEventException("Cost is required");
        }
        if (f.costAmount().signum() < 0) {
            throw new InvalidEventException("Cost cannot be negative");
        }
        String currency = normaliseCurrency(f.currency());
        if (currency == null || !CURRENCY.matcher(currency).matches()) {
            throw new InvalidEventException("Currency must be a three-letter code");
        }
        checkDetails(type, f.details(), fromScan);
        Validity validity = validity(f, rule.validity());
        String label = customLabel(f.customLabel(), rule);
        checkAnnotations(a);
        return new Checked(currency, label, validity);
    }

    private static void checkDetails(EventType type, EventDetails d, boolean fromScan) {
        TypeRule rule = type.rule();
        if (d instanceof ScanDetails) {
            if (!fromScan) {
                throw InvalidEventException.validation("Scan details come only from a scanned document");
            }
            if (rule.detailsKind() != null) {
                throw InvalidEventException.validation(type + " takes " + rule.detailsKind() + " details, not SCAN");
            }
            return;
        }
        if (d == null) {
            // A scanned ITP carries the station it was read from, so its details are always present.
            if (rule.detailsRequired() || (fromScan && rule.detailsKind() != null)) {
                throw InvalidEventException.validation(type + " requires " + rule.detailsKind() + " details");
            }
            return;
        }
        if (rule.detailsKind() == null) {
            throw InvalidEventException.validation(type + " takes no details");
        }
        if (d.kind() != rule.detailsKind()) {
            throw InvalidEventException.validation(type + " takes " + rule.detailsKind() + " details, not " + d.kind());
        }
    }

    private static Validity validity(EventFacts f, TypeRule.ValidityRule rule) {
        LocalDate from = f.validFrom();
        LocalDate until = f.validUntil();
        return switch (rule) {
            case NONE -> {
                if (from != null || until != null) {
                    throw InvalidEventException.validation(f.type() + " has no validity");
                }
                yield null;
            }
            case UNTIL_OPTIONAL -> {
                if (from != null) {
                    throw InvalidEventException.validation("Valid from of " + f.type() + " is the event date");
                }
                yield until == null ? null : new Validity(f.date(), until);
            }
            case UNTIL_REQUIRED -> {
                if (from != null) {
                    throw InvalidEventException.validation("Valid from of " + f.type() + " is the event date");
                }
                if (until == null) {
                    throw InvalidEventException.validation("Valid until is required for " + f.type());
                }
                yield new Validity(f.date(), until);
            }
            case COMPUTED -> {
                if (from == null) {
                    throw InvalidEventException.validation("Valid from is required for " + f.type());
                }
                if (until != null) {
                    throw InvalidEventException.validation(
                            "Valid until of " + f.type() + " is computed, do not send it");
                }
                // checkDetails ran first, so the details are the required RovinietaDetails.
                yield new Validity(from, ((RovinietaDetails) f.details()).duration().endFor(from));
            }
            case RANGE -> {
                if (from == null || until == null) {
                    throw InvalidEventException.validation("Valid from and valid until are required for " + f.type());
                }
                yield new Validity(from, until);
            }
        };
    }

    private static String customLabel(String raw, TypeRule rule) {
        if (!rule.customLabelRequired()) {
            if (raw != null) {
                throw InvalidEventException.validation("A custom label is only allowed on OTHER events");
            }
            return null;
        }
        String label = trimToNull(raw);
        if (label == null || label.length() > MAX_LABEL) {
            throw InvalidEventException.validation("Custom label must be 1 to " + MAX_LABEL + " characters");
        }
        return label;
    }

    private static void checkAnnotations(EventAnnotations a) {
        if (a.customFields().size() > MAX_CUSTOM_FIELDS) {
            throw InvalidEventException.validation("At most " + MAX_CUSTOM_FIELDS + " custom fields are allowed");
        }
    }

    private static String normaliseCurrency(String currency) {
        return currency == null ? null : currency.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static Set<Component> sorted(Set<Component> components) {
        EnumSet<Component> set = EnumSet.noneOf(Component.class);
        if (components != null) {
            set.addAll(components);
        }
        return Collections.unmodifiableSet(set);
    }
}
