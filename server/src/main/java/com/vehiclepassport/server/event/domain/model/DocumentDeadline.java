package com.vehiclepassport.server.event.domain.model;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The state of one car document.
 *
 * @param validUntil null when not recorded or the current entry has no end date
 * @param daysLeft   validUntil minus today, negative when expired, null without validUntil
 * @param eventId    the current entry, null when not recorded
 */
public record DocumentDeadline(DocumentKind kind, DeadlineStatus status, LocalDate validUntil, Integer daysLeft,
        UUID eventId) {
}
