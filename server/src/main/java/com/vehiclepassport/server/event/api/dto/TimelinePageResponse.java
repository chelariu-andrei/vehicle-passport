package com.vehiclepassport.server.event.api.dto;

import java.util.List;

public record TimelinePageResponse(List<EventResponse> items, String nextCursor) {
}
