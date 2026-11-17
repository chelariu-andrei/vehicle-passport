package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.CustomField;
import com.vehiclepassport.server.event.domain.model.DetailsKind;
import com.vehiclepassport.server.event.domain.model.EventAnnotations;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventFacts;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Turns a client's {@link EventInput} into domain facts and annotations. Unknown enum values, a details kind the
 * client may not send (SCAN), fields that belong to another kind, duplicate components and null list elements are
 * refused as validation failures; the type rules themselves are checked by the domain.
 */
final class EventInputService {

    private EventInputService() {
    }

    static EventFacts facts(EventInput i) {
        return new EventFacts(EventType.parse(i.type()), i.date(), i.odometerKm(), i.costAmount(), i.currency(),
                i.customLabel(), i.validFrom(), i.validUntil(), details(i.details()));
    }

    static EventAnnotations annotations(EventInput i) {
        return new EventAnnotations(i.notes(), components(i.components()), customFields(i.customFields()));
    }

    /** Client-sent details; SCAN details are never accepted from a client. */
    static EventDetails details(DetailsView d) {
        if (d == null) {
            return null;
        }
        DetailsKind kind = parse(DetailsKind.class, d.kind(), "details kind");
        return switch (kind) {
            case SCAN -> throw InvalidEventException.validation("Scan details come only from a scanned document");
            case INSURANCE -> {
                onlyFor(kind, d.serviceName(), d.parts(), d.labor(), d.duration(), d.station(), d.result(),
                        d.item());
                yield new InsuranceDetails(parse(InsuranceCoverage.class, d.coverage(), "coverage"), d.insurer(),
                        d.policyNumber());
            }
            case ROVINIETA -> {
                onlyFor(kind, d.serviceName(), d.parts(), d.labor(), d.coverage(), d.insurer(), d.policyNumber(),
                        d.station(), d.result(), d.item());
                yield new RovinietaDetails(parse(RovinietaDuration.class, d.duration(), "duration"));
            }
            case ITP -> {
                onlyFor(kind, d.serviceName(), d.parts(), d.labor(), d.coverage(), d.insurer(), d.policyNumber(),
                        d.duration(), d.item());
                yield new ItpDetails(d.station(), d.result() == null ? null
                        : parse(ItpResult.class, d.result(), "ITP result"));
            }
            case SAFETY_EQUIPMENT -> {
                onlyFor(kind, d.serviceName(), d.parts(), d.labor(), d.coverage(), d.insurer(), d.policyNumber(),
                        d.duration(), d.station(), d.result());
                yield new SafetyEquipmentDetails(parse(SafetyItem.class, d.item(), "safety item"));
            }
        };
    }

    /** A null value is the enum's "required" failure inside the details record; here it is refused the same way. */
    static <E extends Enum<E>> E parse(Class<E> type, String raw, String what) {
        if (raw == null) {
            throw InvalidEventException.validation("The " + what + " is required");
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw InvalidEventException.validation("Unknown " + what + ": " + raw);
        }
    }

    private static void onlyFor(DetailsKind kind, Object... others) {
        for (Object o : others) {
            if (o != null) {
                throw InvalidEventException.validation(kind + " details carry a field of another kind");
            }
        }
    }

    private static Set<Component> components(List<String> raw) {
        Set<Component> out = EnumSet.noneOf(Component.class);
        if (raw == null) {
            return out;
        }
        for (String c : raw) {
            if (!out.add(parse(Component.class, c, "component"))) {
                throw InvalidEventException.validation("Component " + c + " is listed twice");
            }
        }
        return out;
    }

    private static List<CustomField> customFields(List<CustomFieldView> raw) {
        List<CustomField> out = new ArrayList<>();
        if (raw == null) {
            return out;
        }
        for (CustomFieldView f : raw) {
            if (f == null) {
                throw InvalidEventException.validation("A custom field cannot be null");
            }
            out.add(new CustomField(f.label(), f.value()));
        }
        return out;
    }
}
