package com.vehiclepassport.server.event.api.mapper;

import com.vehiclepassport.server.event.api.dto.CustomFieldDto;
import com.vehiclepassport.server.event.api.dto.DetailsDto;
import com.vehiclepassport.server.event.api.dto.EventRequest;
import com.vehiclepassport.server.event.api.dto.EventResponse;
import com.vehiclepassport.server.event.api.dto.PartResponse;
import com.vehiclepassport.server.event.api.dto.TimelinePageResponse;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

/** Null lists and null list elements are passed through as they are; the application refuses what is invalid. */
@ApplicationScoped
public class EventDtoMapper {

    public AddEventCommand toAddCommand(UUID userId, String vin, EventRequest r) {
        return new AddEventCommand(userId, vin, toInput(r));
    }

    public UpdateEventCommand toUpdateCommand(UUID userId, String vin, UUID eventId, EventRequest r) {
        return new UpdateEventCommand(userId, vin, eventId, toInput(r));
    }

    public EventResponse toResponse(EventView v) {
        return new EventResponse(v.id(), v.type(), v.date(), v.odometerKm(), v.costAmount(), v.currency(),
                v.notes(), v.customLabel(), v.validFrom(), v.validUntil(), v.validityStatus(),
                toResponse(v.details()), v.components(),
                v.customFields().stream().map(f -> new CustomFieldDto(f.label(), f.value())).toList(),
                v.evidence(), v.source(), v.documentPresent(), v.attachmentCount());
    }

    public TimelinePageResponse toResponse(TimelinePage page) {
        return new TimelinePageResponse(page.items().stream().map(this::toResponse).toList(), page.nextCursor());
    }

    private static EventInput toInput(EventRequest r) {
        List<CustomFieldView> fields = r.customFields() == null ? null
                : r.customFields().stream().map(f -> f == null ? null : new CustomFieldView(f.label(), f.value()))
                        .toList();
        return new EventInput(r.type(), r.date(), r.odometerKm(), r.costAmount(), r.currency(), r.notes(),
                r.customLabel(), r.validFrom(), r.validUntil(), toView(r.details()), r.components(), fields);
    }

    private static DetailsView toView(DetailsDto d) {
        if (d == null) {
            return null;
        }
        List<PartView> parts = d.parts() == null ? null
                : d.parts().stream().map(p -> p == null ? null : new PartView(p.name(), p.qty(), p.price()))
                        .toList();
        return new DetailsView(d.kind(), d.serviceName(), parts, d.labor(), d.coverage(), d.insurer(),
                d.policyNumber(), d.duration(), d.station(), d.result(), d.item());
    }

    private static DetailsDto toResponse(DetailsView d) {
        if (d == null) {
            return null;
        }
        List<PartResponse> parts = d.parts() == null ? null
                : d.parts().stream().map(p -> new PartResponse(p.name(), p.qty(), p.price())).toList();
        return new DetailsDto(d.kind(), d.serviceName(), parts, d.labor(), d.coverage(), d.insurer(),
                d.policyNumber(), d.duration(), d.station(), d.result(), d.item());
    }
}
