package com.vehiclepassport.server.event.application.port.in;

import java.util.List;

/** Always six items, in the order ITP, RCA, CASCO, ROVINIETA, FIRE_EXTINGUISHER, FIRST_AID_KIT. */
public record DeadlinesView(List<DeadlineItemView> items) {
}
