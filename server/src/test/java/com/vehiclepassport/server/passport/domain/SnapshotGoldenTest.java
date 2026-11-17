package com.vehiclepassport.server.passport.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.domain.model.Snapshot;
import com.vehiclepassport.server.passport.domain.model.SnapshotCustomField;
import com.vehiclepassport.server.passport.domain.model.SnapshotDetails;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotPart;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Passports are hashed once and stay public forever: a snapshot of old-style events must keep this exact canonical
 * form. The literals were captured from the code before the extended-timeline fields existed; never regenerate them.
 */
class SnapshotGoldenTest {

    private static final SnapshotVehicle VEHICLE =
            new SnapshotVehicle("WVWZZZ1JZXW000001", "VW", "Golf", "1.9 TDI", 2005, "DIESEL");

    private static SnapshotEvent scanWithParts() {
        return new SnapshotEvent(UUID.fromString("00000000-0000-0000-0000-000000000001"), "SERVICE",
                LocalDate.of(2025, 3, 1), 120000, new BigDecimal("450"), "RON", "oil \"change\"", "Garage Sud",
                List.of(new SnapshotPart("Oil filter", new BigDecimal("1.50"), new BigDecimal("30")),
                        new SnapshotPart("Oil", new BigDecimal("4"), new BigDecimal("120.5"))),
                new BigDecimal("100"), "DOCUMENTED", true);
    }

    private static SnapshotEvent scanWithoutParts() {
        return new SnapshotEvent(UUID.fromString("00000000-0000-0000-0000-000000000002"), "ITP",
                LocalDate.of(2025, 1, 10), 100000, null, null, null, "ITP Station", null, null, "DOCUMENTED", false);
    }

    private static SnapshotEvent plain() {
        return new SnapshotEvent(UUID.fromString("00000000-0000-0000-0000-000000000003"), "REPAIR",
                LocalDate.of(2025, 2, 1), 110000, new BigDecimal("99.9"), "EUR", "brakes", null, null, null,
                "USER_CONFIRMED", false);
    }

    private static SnapshotEvent noOdometer() {
        return new SnapshotEvent(UUID.fromString("00000000-0000-0000-0000-000000000004"), "SERVICE",
                LocalDate.of(2025, 4, 1), null, null, null, null, null, null, null, "USER_CONFIRMED", false);
    }

    private static SnapshotEvent extended(String type, String customLabel, LocalDate from, LocalDate until,
            SnapshotDetails details, List<String> components, List<SnapshotCustomField> fields) {
        return new SnapshotEvent(UUID.fromString("00000000-0000-0000-0000-000000000009"), type,
                LocalDate.of(2025, 5, 1), null, null, null, null, null, null, null, "USER_CONFIRMED", false,
                customLabel, from, until, details, components, fields);
    }

    @Test
    void newFieldsAppearOnlyWhenSet() {
        String bare = Snapshot.of(VEHICLE, List.of(extended("SERVICE", null, null, null, null, List.of(), List.of())))
                .canonicalJson();
        for (String k : List.of("customLabel", "validFrom", "validUntil", "details", "components", "customFields",
                "validityStatus")) {
            assertFalse(bare.contains("\"" + k + "\""), k + " in " + bare);
        }

        String full = Snapshot.of(VEHICLE, List.of(extended("INSURANCE", "CASCO", LocalDate.of(2025, 5, 1),
                LocalDate.of(2026, 4, 30),
                new SnapshotDetails("INSURANCE", "CASCO", "Allianz", "P-1", null, null, null, null),
                List.of("Engine", "Brakes"), List.of(new SnapshotCustomField("Layers", "3"))))).canonicalJson();
        assertTrue(full.contains("\"customLabel\":\"CASCO\""), full);
        assertTrue(full.contains("\"validFrom\":\"2025-05-01\""), full);
        assertTrue(full.contains("\"validUntil\":\"2026-04-30\""), full);
        assertTrue(full.contains("\"details\":{\"coverage\":\"CASCO\",\"insurer\":\"Allianz\","
                + "\"kind\":\"INSURANCE\",\"policyNumber\":\"P-1\"}"), full);
        assertTrue(full.contains("\"components\":[\"Engine\",\"Brakes\"]"), full);
        assertTrue(full.contains("\"customFields\":[{\"label\":\"Layers\",\"value\":\"3\"}]"), full);
        assertFalse(full.contains("validityStatus"), full);
    }

    @Test
    void oldStyleEventsUnchanged() {
        Snapshot s = Snapshot.of(VEHICLE, List.of(scanWithParts(), scanWithoutParts(), plain(), noOdometer()));
        assertEquals("{\"events\":[{\"date\":\"2025-01-10\",\"documentPresent\":false,\"evidence\":\"DOCUMENTED\","
                + "\"odometerKm\":100000,\"serviceName\":\"ITP Station\",\"type\":\"ITP\"},"
                + "{\"costAmount\":\"99.90\",\"currency\":\"EUR\",\"date\":\"2025-02-01\",\"documentPresent\":false,"
                + "\"evidence\":\"USER_CONFIRMED\",\"notes\":\"brakes\",\"odometerKm\":110000,\"type\":\"REPAIR\"},"
                + "{\"costAmount\":\"450.00\",\"currency\":\"RON\",\"date\":\"2025-03-01\",\"documentPresent\":true,"
                + "\"evidence\":\"DOCUMENTED\",\"labor\":\"100.00\",\"notes\":\"oil \\\"change\\\"\","
                + "\"odometerKm\":120000,\"parts\":[{\"name\":\"Oil filter\",\"price\":\"30.00\",\"qty\":1.5},"
                + "{\"name\":\"Oil\",\"price\":\"120.50\",\"qty\":4}],\"serviceName\":\"Garage Sud\","
                + "\"type\":\"SERVICE\"},{\"date\":\"2025-04-01\",\"documentPresent\":false,"
                + "\"evidence\":\"USER_CONFIRMED\",\"type\":\"SERVICE\"}],\"vehicle\":{\"engine\":\"1.9 TDI\","
                + "\"fuel\":\"DIESEL\",\"make\":\"VW\",\"model\":\"Golf\",\"vin\":\"WVWZZZ1JZXW000001\","
                + "\"year\":2005}}", s.canonicalJson());
        assertEquals("52efcfd2b54a650777433a3d80b99b7ccbe3b2ab8b1d28ab041240fcf3d4dc50", s.hash());
    }
}
