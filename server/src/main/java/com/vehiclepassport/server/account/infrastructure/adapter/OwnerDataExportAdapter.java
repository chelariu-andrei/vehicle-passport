package com.vehiclepassport.server.account.infrastructure.adapter;

import com.vehiclepassport.server.account.application.port.out.OwnerDataExportPort;
import com.vehiclepassport.server.account.domain.model.OwnedData;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.ListEventsByCreatorUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryExportView;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesByCreatorUseCase;
import com.vehiclepassport.server.passport.application.port.in.ListMyPassportsUseCase;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.vehicle.application.port.in.AppearanceView;
import com.vehiclepassport.server.vehicle.application.port.in.ListMyVehiclesUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Collects an owner's vehicles, the events and fill-ups they recorded and their passports through the other features'
 * public use cases only, shaped like the contract's VehicleResponse, EventResponse, FuelEntryResponse and
 * PassportResponse.
 */
@ApplicationScoped
public class OwnerDataExportAdapter implements OwnerDataExportPort {

    @Inject
    ListMyVehiclesUseCase vehicles;
    @Inject
    ListEventsByCreatorUseCase recorded;
    @Inject
    ListMyPassportsUseCase passports;
    @Inject
    ListFuelEntriesByCreatorUseCase fillUps;

    @Override
    public OwnedData exportFor(UUID ownerId) {
        List<VehicleView> owned = vehicles.list(ownerId);
        // The events the user recorded, also on cars sold since; never those of the car's other owners.
        List<Map<String, Object>> events = recorded.listByCreator(ownerId).stream()
                .map(c -> event(c.vin(), c.event())).toList();
        // Like events: every fill-up the user recorded, also on cars sold since.
        List<Map<String, Object>> fuelEntries = fillUps.listByCreator(ownerId).stream()
                .map(OwnerDataExportAdapter::fuelEntry).toList();
        return new OwnedData(owned.stream().map(OwnerDataExportAdapter::vehicle).toList(), events,
                passports.list(ownerId).stream().map(OwnerDataExportAdapter::passport).toList(), fuelEntries);
    }

    private static Map<String, Object> vehicle(VehicleView v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vin", v.vin());
        m.put("make", v.make());
        m.put("model", v.model());
        m.put("engine", v.engine());
        m.put("year", v.year());
        m.put("fuel", v.fuel());
        m.put("plate", v.plate());
        m.put("appearance", appearance(v.appearance()));
        return m;
    }

    private static Map<String, Object> appearance(AppearanceView a) {
        if (a == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bodyType", a.bodyType());
        m.put("color", a.color());
        m.put("colorHex", a.colorHex());
        m.put("finish", a.finish());
        m.put("wheels", a.wheels());
        m.put("rimColor", a.rimColor());
        m.put("glassTint", a.glassTint());
        m.put("contrastRoof", a.contrastRoof());
        return m;
    }

    /** The vin is not part of EventResponse; it is added so an export of several cars stays readable. */
    private static Map<String, Object> event(String vin, EventView e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vin", vin);
        m.put("id", e.id());
        m.put("type", e.type());
        m.put("date", e.date());
        m.put("odometerKm", e.odometerKm());
        m.put("costAmount", e.costAmount());
        m.put("currency", e.currency());
        m.put("notes", e.notes());
        m.put("customLabel", e.customLabel());
        m.put("validFrom", e.validFrom());
        m.put("validUntil", e.validUntil());
        m.put("details", details(e.details()));
        m.put("components", e.components() == null ? List.of() : e.components());
        m.put("customFields", e.customFields() == null ? List.of() : e.customFields().stream().map(f -> {
            Map<String, Object> field = new LinkedHashMap<>();
            field.put("label", f.label());
            field.put("value", f.value());
            return field;
        }).toList());
        m.put("validityStatus", e.validityStatus());
        m.put("evidence", e.evidence());
        m.put("source", e.source());
        m.put("documentPresent", e.documentPresent());
        m.put("attachmentCount", e.attachmentCount());
        return m;
    }

    /** Flat like the API: scan details carry serviceName, parts and labor, the other kinds their own fields. */
    private static Map<String, Object> details(DetailsView d) {
        if (d == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", d.kind());
        switch (d.kind()) {
            case "SCAN" -> {
                m.put("serviceName", d.serviceName());
                m.put("parts", d.parts() == null ? List.of() : d.parts().stream().map(p -> {
                    Map<String, Object> part = new LinkedHashMap<>();
                    part.put("name", p.name());
                    part.put("qty", p.qty());
                    part.put("price", p.price());
                    return part;
                }).toList());
                m.put("labor", d.labor());
            }
            case "INSURANCE" -> {
                m.put("coverage", d.coverage());
                m.put("insurer", d.insurer());
                m.put("policyNumber", d.policyNumber());
            }
            case "ROVINIETA" -> m.put("duration", d.duration());
            case "ITP" -> {
                m.put("station", d.station());
                m.put("result", d.result());
            }
            case "SAFETY_EQUIPMENT" -> m.put("item", d.item());
            default -> { }
        }
        return m;
    }

    /** FuelEntryResponse plus the vin, as for events. */
    private static Map<String, Object> fuelEntry(FuelEntryExportView f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vin", f.vin());
        m.put("id", f.id());
        m.put("date", f.date());
        m.put("odometerKm", f.odometerKm());
        m.put("fuelType", f.fuelType());
        m.put("quantity", f.quantity());
        m.put("unit", f.unit());
        m.put("total", f.total());
        m.put("unitPrice", f.unitPrice());
        m.put("currency", f.currency());
        m.put("fullTank", f.fullTank());
        m.put("missedPrevious", f.missedPrevious());
        m.put("grade", f.grade());
        m.put("chargeType", f.chargeType());
        m.put("station", f.station());
        m.put("note", f.note());
        m.put("consumption", f.consumption());
        return m;
    }

    private static Map<String, Object> passport(PassportView p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id());
        m.put("vin", p.vin());
        m.put("publicUrl", p.publicUrl());
        m.put("hash", p.hash());
        m.put("status", p.status());
        m.put("createdAt", p.createdAt());
        m.put("expiresAt", p.expiresAt());
        return m;
    }
}
