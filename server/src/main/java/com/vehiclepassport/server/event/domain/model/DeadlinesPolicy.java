package com.vehiclepassport.server.event.domain.model;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Document deadlines (deadlines spec §5.2): one item per {@link DocumentKind}, in declaration order, built from the
 * current entry of each validity group. Status rules and the expiring threshold are those of
 * {@link ValidityStatusPolicy}.
 */
public final class DeadlinesPolicy {

    private DeadlinesPolicy() {
    }

    public static List<DocumentDeadline> of(List<VehicleEvent> validityEntries, LocalDate today) {
        Set<UUID> currentIds = ValidityStatusPolicy.currentIds(validityEntries);
        Map<ValidityGroup, VehicleEvent> current = new EnumMap<>(ValidityGroup.class);
        for (VehicleEvent e : validityEntries) {
            if (currentIds.contains(e.id())) {
                ValidityStatusPolicy.group(e).ifPresent(g -> current.put(g, e));
            }
        }
        List<DocumentDeadline> items = new ArrayList<>(DocumentKind.values().length);
        for (DocumentKind kind : DocumentKind.values()) {
            VehicleEvent e = current.get(kind.group());
            items.add(e == null ? new DocumentDeadline(kind, DeadlineStatus.NOT_RECORDED, null, null, null)
                    : deadline(kind, e, today));
        }
        return List.copyOf(items);
    }

    private static DocumentDeadline deadline(DocumentKind kind, VehicleEvent e, LocalDate today) {
        LocalDate until = e.validity() == null ? null : e.validity().validUntil();
        Integer daysLeft = until == null ? null : Math.toIntExact(ChronoUnit.DAYS.between(today, until));
        return new DocumentDeadline(kind, status(ValidityStatusPolicy.status(e, true, today)), until, daysLeft,
                e.id());
    }

    private static DeadlineStatus status(ValidityStatus s) {
        return switch (s) {
            case VALID -> DeadlineStatus.VALID;
            case EXPIRING -> DeadlineStatus.EXPIRING;
            case EXPIRED -> DeadlineStatus.EXPIRED;
            case UNKNOWN -> DeadlineStatus.UNKNOWN;
            case SUPERSEDED -> throw new IllegalStateException("a current entry is never superseded");
        };
    }
}
