package com.vehiclepassport.server.event.api.dto;

import java.util.List;

/** The contract's {@code DeadlinesResponse}: always six items. */
public record DeadlinesResponse(List<DeadlineItemDto> items) {
}
