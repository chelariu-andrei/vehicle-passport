package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

/**
 * One page of a VIN's timeline. {@code filter} null means no filter; {@code order} is {@code asc} or {@code desc},
 * ascending when null; {@code cursor} is a previous page's {@code nextCursor}, only valid with the same order.
 */
public record TimelineQuery(UUID userId, String vin, TimelineFilterView filter, String order, String cursor,
        int limit) {

    /** The first page, unfiltered, oldest first. */
    public static TimelineQuery firstPage(UUID userId, String vin, int limit) {
        return new TimelineQuery(userId, vin, null, null, null, limit);
    }
}
