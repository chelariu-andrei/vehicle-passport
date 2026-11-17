package com.vehiclepassport.server.fuel.application.port.in;

import java.util.List;

/** Newest first; {@code nextCursor} is null on the last page. */
public record FuelEntryPage(List<FuelEntryView> items, String nextCursor) {
}
