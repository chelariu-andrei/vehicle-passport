package com.vehiclepassport.server.event.api.dto;

import java.time.LocalDate;
import java.util.UUID;

/** The contract's {@code DeadlineItem}; every field is always present, the last three null when unknown. */
public record DeadlineItemDto(String kind, String status, LocalDate validUntil, Integer daysLeft, UUID eventId) {
}
