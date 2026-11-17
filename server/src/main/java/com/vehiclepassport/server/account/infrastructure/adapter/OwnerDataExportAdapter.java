package com.vehiclepassport.server.account.infrastructure.adapter;

import com.vehiclepassport.server.account.application.port.out.OwnerDataExportPort;
import com.vehiclepassport.server.account.domain.model.OwnedData;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.ListEventsByCreatorUseCase;
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
 * Collects an owner's vehicles, the events they recorded and their passports through the other features' public
 * use cases only, shaped like the contract's VehicleResponse, EventResponse and PassportResponse.
 */
@ApplicationScoped
public class OwnerDataExportAdapter implements OwnerDataExportPort {

    @Inject
    ListMyVehiclesUseCase vehicles;
    @Inject
    ListEventsByCreatorUseCase recorded;
    @Inject
    ListMyPassportsUseCase passports;

    @Override
    public OwnedData exportFor(UUID ownerId) {
        List<VehicleView> owned = vehicles.list(ownerId);
        // The events the user recorded, also on cars sold since; never those of the car's other owners.
        List<Map<String, Object>> events = recorded.listByCreator(ownerId).stream()
                .map(c -> event(c.vin(), c.event())).toList();
        return new OwnedData(owned.stream().map(OwnerDataExportAdapter::vehicle).toList(), events,
                passports.list(ownerId).stream().map(OwnerDataExportAdapter::passport).toList());
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
        m.put("details", details(e.details()));
        m.put("evidence", e.evidence());
        m.put("source", e.source());
        m.put("documentPresent", e.documentPresent());
        m.put("attachmentCount", e.attachmentCount());
        return m;
    }

    /** Only scan details are exported so far; the other kinds are added with the rest of the new fields. */
    private static Map<String, Object> details(DetailsView d) {
        if (d == null || !"SCAN".equals(d.kind())) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("serviceName", d.serviceName());
        m.put("parts", d.parts() == null ? List.of() : d.parts().stream().map(p -> {
            Map<String, Object> part = new LinkedHashMap<>();
            part.put("name", p.name());
            part.put("qty", p.qty());
            part.put("price", p.price());
            return part;
        }).toList());
        m.put("labor", d.labor());
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
