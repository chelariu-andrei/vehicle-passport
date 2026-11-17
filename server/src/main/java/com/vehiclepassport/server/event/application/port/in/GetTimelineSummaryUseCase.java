package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

/**
 * Counts, costs, distance and years of a VIN's timeline. Same access rules as {@link GetTimelineUseCase}; a null
 * filter means no filter.
 */
public interface GetTimelineSummaryUseCase {

    TimelineSummaryView summary(UUID userId, String vin, TimelineFilterView filter);
}
