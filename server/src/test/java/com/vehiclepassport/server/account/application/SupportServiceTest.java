package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.application.service.SupportService;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.SupportDiagnostics;
import com.vehiclepassport.server.account.domain.model.SupportKind;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SupportServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-0000000000e1");
    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");
    private static final SupportDiagnostics DIAG = new SupportDiagnostics("1.2.3", "ios", "18.1", "iPhone 15");

    private final List<SupportReport> saved = new ArrayList<>();
    private final List<UUID> owners = new ArrayList<>();

    private final SupportReportPort port = new SupportReportPort() {
        public void save(UUID id, UUID userId, SupportReport report, Instant createdAt) {
            saved.add(report);
            owners.add(userId);
        }

        public List<com.vehiclepassport.server.account.domain.model.SubmittedSupportReport> findByUser(UUID userId) {
            return List.of();
        }
    };

    private final Clock clock = new Clock() {
        public ZoneId getZone() { return ZoneOffset.UTC; }

        public Clock withZone(ZoneId zone) { return this; }

        public Instant instant() { return NOW; }
    };

    private final SupportService service = new SupportService(port, clock);

    @Test
    void createsAReportAndReturnsItsId() {
        UUID id = service.create(USER, new SupportReport(SupportKind.PROBLEM, "The scan screen freezes.", false, null));
        assertNotNull(id);
        assertEquals(1, saved.size());
        assertEquals(USER, owners.get(0));
    }

    @Test
    void messageUnderTenCharsIsRejected() {
        assertThrows(ValidationFailedException.class,
                () -> service.create(USER, new SupportReport(SupportKind.QUESTION, "too short", false, null)));
        assertEquals(0, saved.size());
    }

    @Test
    void messageIsMeasuredAfterTrimming() {
        assertThrows(ValidationFailedException.class,
                () -> service.create(USER, new SupportReport(SupportKind.QUESTION, "   short    ", false, null)));
    }

    @Test
    void messageOverFourThousandCharsIsRejected() {
        assertThrows(ValidationFailedException.class,
                () -> service.create(USER, new SupportReport(SupportKind.PROBLEM, "x".repeat(4001), false, null)));
        service.create(USER, new SupportReport(SupportKind.PROBLEM, "x".repeat(4000), false, null));
        assertEquals(1, saved.size());
    }

    @Test
    void diagnosticsAreDroppedWhenTheFlagIsFalse() {
        service.create(USER, new SupportReport(SupportKind.PROBLEM, "The scan screen freezes.", false, DIAG));
        assertNull(saved.get(0).diagnostics());
    }

    @Test
    void diagnosticsAreKeptOnlyWhenTheFlagIsTrue() {
        service.create(USER, new SupportReport(SupportKind.PROBLEM, "The scan screen freezes.", true, DIAG));
        assertEquals(DIAG, saved.get(0).diagnostics());
    }

    @Test
    void flagTrueWithoutDiagnosticsStoresNone() {
        service.create(USER, new SupportReport(SupportKind.PROBLEM, "The scan screen freezes.", true, null));
        assertNull(saved.get(0).diagnostics());
    }

    @Test
    void storedMessageIsTrimmed() {
        service.create(USER, new SupportReport(SupportKind.QUESTION, "  How do I transfer a car?  ", false, null));
        assertEquals("How do I transfer a car?", saved.get(0).message());
    }
}
