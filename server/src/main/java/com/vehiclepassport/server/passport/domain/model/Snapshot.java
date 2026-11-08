package com.vehiclepassport.server.passport.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record Snapshot(String canonicalJson, String hash) {

    public static Snapshot of(SnapshotVehicle vehicle, List<SnapshotEvent> events) {
        List<SnapshotEvent> sorted = new ArrayList<>(events);
        sorted.sort(Comparator.comparing(SnapshotEvent::date).thenComparing(SnapshotEvent::sortId));

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("vehicle", vehicleMap(vehicle));
        List<Object> evs = new ArrayList<>();
        for (SnapshotEvent e : sorted) {
            evs.add(eventMap(e));
        }
        root.put("events", evs);

        String json = CanonicalJson.write(root);
        return new Snapshot(json, SnapshotHasher.sha256Hex(json));
    }

    private static Map<String, Object> vehicleMap(SnapshotVehicle v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vin", v.vin());
        m.put("make", v.make());
        m.put("model", v.model());
        m.put("engine", v.engine());
        m.put("year", v.year());
        m.put("fuel", v.fuel());
        return m;
    }

    private static Map<String, Object> eventMap(SnapshotEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", e.type());
        m.put("date", e.date() == null ? null : e.date().toString());
        m.put("odometerKm", e.odometerKm());
        m.put("costAmount", money(e.costAmount()));
        m.put("currency", e.currency());
        m.put("notes", e.notes());
        m.put("serviceName", e.serviceName());
        if (e.parts() != null) {
            List<Object> parts = new ArrayList<>();
            for (SnapshotPart p : e.parts()) {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("name", p.name());
                pm.put("qty", p.qty() == null ? null : p.qty().stripTrailingZeros());
                pm.put("price", money(p.price()));
                parts.add(pm);
            }
            m.put("parts", parts);
        }
        m.put("labor", money(e.labor()));
        m.put("evidence", e.evidence());
        m.put("documentPresent", e.documentPresent());
        return m;
    }

    private static String money(BigDecimal v) {
        return v == null ? null : v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
