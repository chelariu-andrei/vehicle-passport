package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface GetTimelineUseCase {

    TimelinePage get(UUID userId, String vin, String cursor, int limit);
}
