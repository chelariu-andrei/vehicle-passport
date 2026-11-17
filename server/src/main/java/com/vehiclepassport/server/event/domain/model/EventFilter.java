package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidTimelineFilterException;
import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * Which events of a timeline to show. An empty set means no restriction; within a set any value matches (an event
 * matches the components when it is tagged with at least one of them). {@code from} and {@code to} are inclusive
 * bounds on the event date and either may be open (null).
 */
public record EventFilter(Set<EventType> types, Set<Component> components, LocalDate from, LocalDate to) {

    private static final EventFilter NONE = new EventFilter(null, null, null, null);

    public EventFilter {
        if (from != null && to != null && from.isAfter(to)) {
            throw new InvalidTimelineFilterException("Period start " + from + " is after its end " + to);
        }
        types = types == null || types.isEmpty() ? Set.of()
                : Collections.unmodifiableSet(EnumSet.copyOf(types));
        components = components == null || components.isEmpty() ? Set.of()
                : Collections.unmodifiableSet(EnumSet.copyOf(components));
    }

    public static EventFilter none() {
        return NONE;
    }
}
