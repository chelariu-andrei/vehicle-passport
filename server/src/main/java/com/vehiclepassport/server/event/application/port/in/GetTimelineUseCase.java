package com.vehiclepassport.server.event.application.port.in;

public interface GetTimelineUseCase {

    TimelinePage get(TimelineQuery query);
}
