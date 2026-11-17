package com.vehiclepassport.server.event.application.port.in;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One document; enum values travel as strings. {@code validUntil}, {@code daysLeft} and {@code eventId} are null
 * when the document is not recorded; {@code validUntil} and {@code daysLeft} also when the current entry has no end
 * date. {@code daysLeft} is negative once expired.
 */
public record DeadlineItemView(String kind, String status, LocalDate validUntil, Integer daysLeft, UUID eventId) {
}
