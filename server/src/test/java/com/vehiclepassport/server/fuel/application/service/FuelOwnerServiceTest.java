package com.vehiclepassport.server.fuel.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.port.in.FuelEntryExportView;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FuelOwnerServiceTest {

    private static final UUID ME = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();
    private static final UUID TOMBSTONE = new UUID(0, 0);
    private static final String SOLD = "WVWZZZ1JZXW000002";
    private static final Instant T0 = Instant.parse("2026-10-01T10:00:00Z");

    private final FuelFakes.Repo repo = new FuelFakes.Repo();
    private final FuelOwnerService service = new FuelOwnerService(repo);

    private FuelEntry entry(UUID by, String vin, UUID period, String date, int km, String quantity) {
        FuelEntry e = new FuelEntry(UUID.randomUUID(), vin, period, by, LocalDate.parse(date), km,
                FuelEntryType.DIESEL, new BigDecimal(quantity), new BigDecimal("300.00"), new BigDecimal("7.5000"),
                "RON", null, null, "Petrom", null, true, false, T0.plusSeconds(km));
        repo.save(e);
        return e;
    }

    @Test
    void detach_deletes_every_entry_the_person_created() {
        UUID myPeriod = UUID.randomUUID();
        UUID soldPeriod = UUID.randomUUID();
        entry(ME, FuelFakes.VIN, myPeriod, "2026-10-01", 10000, "40.0");
        FuelEntry gone = entry(ME, FuelFakes.VIN, myPeriod, "2026-10-20", 10600, "42.0");
        entry(ME, SOLD, soldPeriod, "2025-05-01", 50000, "40.0");
        repo.softDelete(gone.id(), T0);
        FuelEntry theirs = entry(OTHER, FuelFakes.VIN, UUID.randomUUID(), "2026-11-01", 11000, "40.0");

        service.detach(ME, TOMBSTONE);

        assertEquals(List.of(theirs.id()), List.copyOf(repo.rows.keySet()));
        service.detach(ME, TOMBSTONE);
        assertEquals(1, repo.rows.size());
    }

    @Test
    void list_by_creator_spans_every_car_with_vin_and_consumption() {
        UUID myPeriod = UUID.randomUUID();
        UUID soldPeriod = UUID.randomUUID();
        FuelEntry first = entry(ME, FuelFakes.VIN, myPeriod, "2026-10-01", 10000, "40.0");
        FuelEntry second = entry(ME, FuelFakes.VIN, myPeriod, "2026-10-20", 10600, "42.0");
        FuelEntry sold = entry(ME, SOLD, soldPeriod, "2025-05-01", 50000, "40.0");
        entry(OTHER, FuelFakes.VIN, UUID.randomUUID(), "2026-11-01", 11000, "40.0");

        List<FuelEntryExportView> mine = service.listByCreator(ME);

        assertEquals(List.of(first.id(), second.id(), sold.id()), mine.stream().map(FuelEntryExportView::id).toList());
        assertEquals(List.of(FuelFakes.VIN, FuelFakes.VIN, SOLD), mine.stream().map(FuelEntryExportView::vin).toList());
        assertNull(mine.get(0).consumption());
        assertEquals(new BigDecimal("7.00"), mine.get(1).consumption());
        assertEquals("DIESEL", mine.get(1).fuelType());
        assertEquals("L", mine.get(1).unit());
        assertEquals("Petrom", mine.get(2).station());
    }

    @Test
    void list_by_creator_leaves_out_deleted_entries() {
        FuelEntry e = entry(ME, FuelFakes.VIN, UUID.randomUUID(), "2026-10-01", 10000, "40.0");
        repo.softDelete(e.id(), T0);
        assertTrue(service.listByCreator(ME).isEmpty());
    }
}
