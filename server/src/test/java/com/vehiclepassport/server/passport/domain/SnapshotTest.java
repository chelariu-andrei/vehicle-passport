package com.vehiclepassport.server.passport.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.domain.model.Snapshot;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotHasher;
import com.vehiclepassport.server.passport.domain.model.SnapshotPart;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SnapshotTest {

    private static final SnapshotVehicle VEHICLE =
            new SnapshotVehicle("WVWZZZ1JZXW000001", "VW", "Golf", "1.9 TDI", 2005, "DIESEL");

    private static SnapshotEvent event(String id, LocalDate date, BigDecimal cost) {
        return new SnapshotEvent(
                UUID.fromString(id), "SERVICE", date, 120000, cost, "RON", "oil \"change\"", "Garage",
                List.of(new SnapshotPart("Filter", new BigDecimal("1"), new BigDecimal("30"))),
                new BigDecimal("100"), "RECEIPT", true);
    }

    private static final SnapshotEvent E1 =
            event("00000000-0000-0000-0000-000000000001", LocalDate.of(2025, 3, 1), new BigDecimal("450"));
    private static final SnapshotEvent E2 =
            event("00000000-0000-0000-0000-000000000002", LocalDate.of(2025, 3, 1), new BigDecimal("10"));
    private static final SnapshotEvent E3 =
            event("00000000-0000-0000-0000-000000000000", LocalDate.of(2025, 4, 1), new BigDecimal("20"));

    @Test
    void same_input_same_hash() {
        assertEquals(Snapshot.of(VEHICLE, List.of(E1, E2)).hash(), Snapshot.of(VEHICLE, List.of(E1, E2)).hash());
    }

    @Test
    void event_order_in_input_does_not_change_hash() {
        Snapshot a = Snapshot.of(VEHICLE, List.of(E1, E2, E3));
        Snapshot b = Snapshot.of(VEHICLE, List.of(E3, E2, E1));
        assertEquals(a.canonicalJson(), b.canonicalJson());
        assertEquals(a.hash(), b.hash());
        String j = a.canonicalJson();
        assertTrue(j.indexOf("\"costAmount\":\"450.00\"") < j.indexOf("\"costAmount\":\"10.00\""));
        assertTrue(j.indexOf("\"costAmount\":\"10.00\"") < j.indexOf("\"costAmount\":\"20.00\""));
    }

    @Test
    void money_has_two_decimals() {
        String json = Snapshot.of(VEHICLE, List.of(E1)).canonicalJson();
        assertTrue(json.contains("\"costAmount\":\"450.00\""));
        assertTrue(json.contains("\"labor\":\"100.00\""));
        assertTrue(json.contains("\"price\":\"30.00\""));
        String rounded = Snapshot.of(VEHICLE, List.of(event("00000000-0000-0000-0000-000000000001",
                LocalDate.of(2025, 3, 1), new BigDecimal("1.005")))).canonicalJson();
        assertTrue(rounded.contains("\"costAmount\":\"1.01\""));
    }

    @Test
    void date_is_iso() {
        assertTrue(Snapshot.of(VEHICLE, List.of(E1)).canonicalJson().contains("\"date\":\"2025-03-01\""));
    }

    @Test
    void json_has_no_owner_keys() {
        String json = Snapshot.of(VEHICLE, List.of(E1, E2)).canonicalJson();
        for (String k : List.of("createdBy", "ownerId", "periodId", "ownedFrom", "ownedTo", "sortId", "id")) {
            assertFalse(json.contains("\"" + k + "\":"), k);
        }
    }

    @Test
    void sha256_known_vector() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                SnapshotHasher.sha256Hex("abc"));
    }
}
