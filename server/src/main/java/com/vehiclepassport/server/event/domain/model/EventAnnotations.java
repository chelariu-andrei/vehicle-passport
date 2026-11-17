package com.vehiclepassport.server.event.domain.model;

import java.util.List;
import java.util.Set;

/** What the owner adds around the facts. Always editable, even on a documented event. */
public record EventAnnotations(String notes, Set<Component> components, List<CustomField> customFields) {

    public EventAnnotations {
        components = components == null ? Set.of() : Set.copyOf(components);
        customFields = customFields == null ? List.of() : List.copyOf(customFields);
    }
}