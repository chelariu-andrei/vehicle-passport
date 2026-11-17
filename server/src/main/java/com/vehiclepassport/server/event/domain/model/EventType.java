package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.TypeRule.OdometerRule;
import com.vehiclepassport.server.event.domain.model.TypeRule.ValidityRule;
import java.util.Locale;

/** Event types with their rule (spec §5.1). */
public enum EventType {
    SERVICE(new TypeRule(OdometerRule.REQUIRED, ValidityRule.NONE, null, false, false)),
    REPAIR(new TypeRule(OdometerRule.REQUIRED, ValidityRule.NONE, null, false, false)),
    TIRES(new TypeRule(OdometerRule.REQUIRED, ValidityRule.NONE, null, false, false)),
    ITP(new TypeRule(OdometerRule.REQUIRED, ValidityRule.UNTIL_OPTIONAL, DetailsKind.ITP, false, false)),
    ROVINIETA(new TypeRule(OdometerRule.OPTIONAL, ValidityRule.COMPUTED, DetailsKind.ROVINIETA, true, false)),
    INSURANCE(new TypeRule(OdometerRule.OPTIONAL, ValidityRule.RANGE, DetailsKind.INSURANCE, true, false)),
    SAFETY_EQUIPMENT(new TypeRule(OdometerRule.OPTIONAL, ValidityRule.UNTIL_REQUIRED, DetailsKind.SAFETY_EQUIPMENT,
            true, false)),
    OTHER(new TypeRule(OdometerRule.OPTIONAL, ValidityRule.NONE, null, false, true));

    private final TypeRule rule;

    EventType(TypeRule rule) {
        this.rule = rule;
    }

    public TypeRule rule() {
        return rule;
    }

    public static EventType parse(String raw) {
        if (raw == null) {
            throw InvalidEventException.validation("Event type is required");
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw InvalidEventException.validation("Unknown event type: " + raw);
        }
    }
}