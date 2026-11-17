package com.vehiclepassport.server.event.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.event.application.service.EventService;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Confirming a scan: a scanned ITP carries ItpDetails (station from the reviewed service name), others ScanDetails. */
class EventServiceScanConfirmTest {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final UUID USER = UUID.randomUUID();
    private static final DetailsView REVIEWED = DetailsView.scan("Auto Service SRL",
            List.of(new PartView("Oil filter", BigDecimal.ONE, new BigDecimal("45.50"))), new BigDecimal("100"));

    private final List<VehicleEvent> saved = new ArrayList<>();
    private final EventService service = new EventService(new EventRepositoryPort() {
        public void lockTimeline(String vin) { }
        public Optional<VehicleEvent> findActive(String vin, UUID id) { return Optional.empty(); }
        public Neighbours neighbours(String vin, LocalDate d, Instant c, UUID x) { return new Neighbours(null, null); }
        public void save(VehicleEvent e) { saved.add(e); }
        public List<VehicleEvent> page(String vin, EventFilter f, TimelineOrder o, TimelineCursor a, int l) { return List.of(); }
        public List<VehicleEvent> allActive(String vin) { return saved; }
        public long countActiveByCreator(UUID userId) { return 0; }
        public List<VehicleEvent> activeByCreator(UUID userId) { return List.of(); }
        public void detachCreator(UUID userId, UUID tombstone) { }
    }, (ActiveOwnerPort) (vin, user) -> new OwnedPeriod(vin, UUID.randomUUID()),
            new AttachmentServiceTest.FakeAttachments(),
            Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), ZoneOffset.UTC));

    private static SaveConfirmedEventCommand confirm(String type, DetailsView details) {
        return new SaveConfirmedEventCommand(USER, VIN, type, LocalDate.parse("2026-01-10"), 120000,
                new BigDecimal("250.00"), "RON", "n", details, "scans/k.pdf", "application/pdf", null, 0, null, null);
    }

    private VehicleEvent only() {
        assertEquals(1, saved.size());
        return saved.get(0);
    }

    private EventView view() {
        List<EventView> views = service.history(VIN);
        assertEquals(1, views.size());
        return views.get(0);
    }

    @Test
    void scanned_itp_keeps_station_from_service_name_and_drops_parts_and_labor() {
        service.save(confirm("ITP", REVIEWED));

        assertEquals(new ItpDetails("Auto Service SRL", null), only().details());
        EventView v = view();
        assertEquals("ITP", v.type());
        assertEquals(new DetailsView("ITP", null, null, null, null, null, null, null, "Auto Service SRL", null,
                null), v.details());
        assertNull(v.validUntil());
    }

    @Test
    void scanned_itp_carries_valid_until_and_result() {
        service.save(new SaveConfirmedEventCommand(USER, VIN, "ITP", LocalDate.parse("2026-01-10"), 120000,
                new BigDecimal("250.00"), "RON", "n", REVIEWED, "scans/k.pdf", "application/pdf", null, 0,
                LocalDate.parse("2028-01-10"), "PASSED"));

        assertEquals(new ItpDetails("Auto Service SRL", ItpResult.PASSED), only().details());
        EventView v = view();
        assertEquals(LocalDate.parse("2026-01-10"), v.validFrom());
        assertEquals(LocalDate.parse("2028-01-10"), v.validUntil());
        assertEquals("PASSED", v.details().result());
        assertEquals("DOCUMENTED", v.evidence());
    }

    @Test
    void validity_fields_on_a_non_itp_scan_are_refused() {
        InvalidEventException e = assertThrows(InvalidEventException.class,
                () -> service.save(new SaveConfirmedEventCommand(USER, VIN, "SERVICE", LocalDate.parse("2026-01-10"),
                        120000, new BigDecimal("250.00"), "RON", "n", REVIEWED, "scans/k.pdf", "application/pdf",
                        null, 0, null, "PASSED")));
        assertEquals("validation-failed", e.code());
        assertTrue(saved.isEmpty());
    }

    @Test
    void an_old_scanned_itp_with_scan_details_is_shown_as_scan() {
        saved.add(new VehicleEvent(UUID.randomUUID(), VIN, EventType.ITP, LocalDate.parse("2025-01-10"), 100000,
                BigDecimal.TEN, "RON", null, null, null, new ScanDetails("RAR", List.of(), null), null, null,
                EvidenceLevel.DOCUMENTED, EventSource.SCAN, USER, UUID.randomUUID(), null,
                Instant.parse("2025-01-10T10:00:00Z"), null));

        assertEquals(DetailsView.scan("RAR", List.of(), null), view().details());
    }

    @Test
    void scanned_itp_without_service_name_has_itp_details_with_null_station() {
        service.save(confirm("ITP", DetailsView.scan(null, List.of(), null)));
        assertEquals(new ItpDetails(null, null), only().details());

        saved.clear();
        service.save(confirm("ITP", null));
        assertEquals(new ItpDetails(null, null), only().details());
    }

    @Test
    void scanned_itp_with_service_name_over_100_chars_is_refused() {
        InvalidEventException e = assertThrows(InvalidEventException.class,
                () -> service.save(confirm("ITP", DetailsView.scan("s".repeat(101), List.of(), null))));
        assertEquals("validation-failed", e.code());
        assertTrue(saved.isEmpty());
    }

    @Test
    void scanned_service_keeps_scan_details_unchanged() {
        service.save(confirm("SERVICE", REVIEWED));

        assertEquals(new ScanDetails("Auto Service SRL",
                List.of(new PartLine("Oil filter", BigDecimal.ONE, new BigDecimal("45.50"))), new BigDecimal("100")),
                only().details());
        assertEquals(REVIEWED, view().details());
    }
}
