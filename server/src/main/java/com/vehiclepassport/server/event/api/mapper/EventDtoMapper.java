package com.vehiclepassport.server.event.api.mapper;

import com.vehiclepassport.server.event.api.dto.DetailsResponse;
import com.vehiclepassport.server.event.api.dto.EventRequest;
import com.vehiclepassport.server.event.api.dto.EventResponse;
import com.vehiclepassport.server.event.api.dto.PartResponse;
import com.vehiclepassport.server.event.api.dto.TimelinePageResponse;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class EventDtoMapper {

    public AddEventCommand toAddCommand(UUID userId, String vin, EventRequest r) {
        return new AddEventCommand(userId, vin, r.type(), r.date(), r.odometerKm(), r.costAmount(), r.currency(),
                r.notes());
    }

    public UpdateEventCommand toUpdateCommand(UUID userId, String vin, UUID eventId, EventRequest r) {
        return new UpdateEventCommand(userId, vin, eventId, r.type(), r.date(), r.odometerKm(), r.costAmount(),
                r.currency(), r.notes());
    }

    public EventResponse toResponse(EventView v) {
        return new EventResponse(v.id(), v.type(), v.date(), v.odometerKm(), v.costAmount(), v.currency(),
                v.notes(), toResponse(v.details()), v.evidence(), v.source(), v.documentPresent());
    }

    public TimelinePageResponse toResponse(TimelinePage page) {
        return new TimelinePageResponse(page.items().stream().map(this::toResponse).toList(), page.nextCursor());
    }

    private DetailsResponse toResponse(DetailsView d) {
        if (d == null) {
            return null;
        }
        return new DetailsResponse(d.serviceName(),
                d.parts().stream().map(p -> new PartResponse(p.name(), p.qty(), p.price())).toList(), d.labor());
    }
}
