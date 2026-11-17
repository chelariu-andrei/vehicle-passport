package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.domain.exception.InvalidTimelineFilterException;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.EventType;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class EventFilterTest {

    @Test
    void fromAfterToRefused() {
        InvalidTimelineFilterException e = assertThrows(InvalidTimelineFilterException.class,
                () -> new EventFilter(null, null, LocalDate.parse("2025-12-31"), LocalDate.parse("2025-01-01")));
        assertEquals("validation-failed", e.code());
        assertEquals(400, e.kind().status());
    }

    @Test
    void sameDayPeriodAndOpenEndsAccepted() {
        LocalDate day = LocalDate.parse("2025-03-01");
        assertEquals(day, new EventFilter(null, null, day, day).from());
        assertNull(new EventFilter(null, null, day, null).to());
        assertNull(new EventFilter(null, null, null, day).from());
    }

    @Test
    void nullSetsMeanAll() {
        EventFilter f = new EventFilter(null, null, null, null);
        assertTrue(f.types().isEmpty());
        assertTrue(f.components().isEmpty());
        assertEquals(EventFilter.none(), f);
    }

    @Test
    void setsAreCopied() {
        Set<EventType> types = EnumSet.of(EventType.ITP);
        Set<Component> components = EnumSet.of(Component.BRAKES);
        EventFilter f = new EventFilter(types, components, null, null);
        types.add(EventType.REPAIR);
        components.add(Component.ENGINE);
        assertEquals(Set.of(EventType.ITP), f.types());
        assertEquals(Set.of(Component.BRAKES), f.components());
        assertThrows(UnsupportedOperationException.class, () -> f.types().add(EventType.OTHER));
    }
}
