package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;

public record SafetyEquipmentDetails(SafetyItem item) implements EventDetails {

    public SafetyEquipmentDetails {
        if (item == null) {
            throw InvalidEventException.validation("Safety equipment item is required");
        }
    }

    @Override
    public DetailsKind kind() {
        return DetailsKind.SAFETY_EQUIPMENT;
    }
}