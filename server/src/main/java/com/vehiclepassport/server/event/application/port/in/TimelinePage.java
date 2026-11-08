package com.vehiclepassport.server.event.application.port.in;

import java.util.List;

public record TimelinePage(List<EventView> items, String nextCursor) {
}
