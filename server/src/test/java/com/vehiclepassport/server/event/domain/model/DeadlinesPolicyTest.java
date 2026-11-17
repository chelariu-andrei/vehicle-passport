package com.vehiclepassport.server.event.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeadlinesPolicyTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-16");
    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");

    private static VehicleEvent event(EventType type, String date, Validity validity, EventDetails details) {
        return new VehicleEvent(UUID.randomUUID(), "WVWZZZ1JZXW000001", type, LocalDate.parse(date), null,
                BigDecimal.TEN, "RON", null, null, validity, details, Set.of(), List.of(),
                EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, UUID.randomUUID(), UUID.randomUUID(), null, T0,
                null);
    }

    private static Validity valid(String from, String until) {
        return new Validity(LocalDate.parse(from), until == null ? null : LocalDate.parse(until));
    }

    private static VehicleEvent insurance(InsuranceCoverage coverage, String from, String until) {
        return event(EventType.INSURANCE, from, valid(from, until), new InsuranceDetails(coverage, "Allianz", null));
    }

    private static VehicleEvent rcaUntil(String until) {
        return insurance(InsuranceCoverage.RCA, "2026-01-01", until);
    }

    private static DocumentDeadline only(List<DocumentDeadline> items, DocumentKind kind) {
        return items.stream().filter(d -> d.kind() == kind).findFirst().orElseThrow();
    }

    @Test
    void emptyHistoryGivesSixNotRecordedInFixedOrder() {
        List<DocumentDeadline> items = DeadlinesPolicy.of(List.of(), TODAY);

        assertEquals(List.of(DocumentKind.ITP, DocumentKind.RCA, DocumentKind.CASCO, DocumentKind.ROVINIETA,
                DocumentKind.FIRE_EXTINGUISHER, DocumentKind.FIRST_AID_KIT),
                items.stream().map(DocumentDeadline::kind).toList());
        for (DocumentDeadline d : items) {
            assertEquals(DeadlineStatus.NOT_RECORDED, d.status());
            assertNull(d.validUntil());
            assertNull(d.daysLeft());
            assertNull(d.eventId());
        }
    }

    @Test
    void exactly30DaysLeftIsExpiring() {
        DocumentDeadline rca = only(DeadlinesPolicy.of(List.of(rcaUntil("2026-12-16")), TODAY), DocumentKind.RCA);
        assertEquals(DeadlineStatus.EXPIRING, rca.status());
        assertEquals(ValidityStatusPolicy.EXPIRING_DAYS, rca.daysLeft());
    }

    @Test
    void thirtyOneDaysLeftIsValid() {
        DocumentDeadline rca = only(DeadlinesPolicy.of(List.of(rcaUntil("2026-12-17")), TODAY), DocumentKind.RCA);
        assertEquals(DeadlineStatus.VALID, rca.status());
        assertEquals(31, rca.daysLeft());
        assertEquals(LocalDate.parse("2026-12-17"), rca.validUntil());
    }

    @Test
    void expiresTodayIsExpiringWithZeroDaysLeft() {
        DocumentDeadline rca = only(DeadlinesPolicy.of(List.of(rcaUntil("2026-11-16")), TODAY), DocumentKind.RCA);
        assertEquals(DeadlineStatus.EXPIRING, rca.status());
        assertEquals(0, rca.daysLeft());
    }

    @Test
    void expiredYesterdayIsExpiredWithMinusOne() {
        DocumentDeadline rca = only(DeadlinesPolicy.of(List.of(rcaUntil("2026-11-15")), TODAY), DocumentKind.RCA);
        assertEquals(DeadlineStatus.EXPIRED, rca.status());
        assertEquals(-1, rca.daysLeft());
    }

    @Test
    void itpWithoutValidUntilIsUnknown() {
        VehicleEvent itp = event(EventType.ITP, "2026-03-01", null, new ItpDetails("RAR Iasi", null));
        DocumentDeadline d = only(DeadlinesPolicy.of(List.of(itp), TODAY), DocumentKind.ITP);
        assertEquals(DeadlineStatus.UNKNOWN, d.status());
        assertNull(d.validUntil());
        assertNull(d.daysLeft());
        assertEquals(itp.id(), d.eventId());
    }

    @Test
    void renewedRcaReplacesTheOlderOne() {
        VehicleEvent older = insurance(InsuranceCoverage.RCA, "2025-11-01", "2026-10-31");
        VehicleEvent newer = insurance(InsuranceCoverage.RCA, "2026-11-01", "2027-10-31");

        DocumentDeadline rca = only(DeadlinesPolicy.of(List.of(newer, older), TODAY), DocumentKind.RCA);

        assertEquals(DeadlineStatus.VALID, rca.status());
        assertEquals(newer.id(), rca.eventId());
        assertEquals(LocalDate.parse("2027-10-31"), rca.validUntil());
    }

    @Test
    void cascoAbsentIsNotRecordedAndOptional() {
        DocumentDeadline casco = only(DeadlinesPolicy.of(List.of(rcaUntil("2027-01-01")), TODAY),
                DocumentKind.CASCO);
        assertEquals(DeadlineStatus.NOT_RECORDED, casco.status());
        assertTrue(DocumentKind.CASCO.optional());
        assertEquals(List.of(DocumentKind.CASCO),
                Arrays.stream(DocumentKind.values()).filter(DocumentKind::optional).toList());
    }

    @Test
    void legacyInsuranceWithoutDetailsBelongsToNoGroup() {
        VehicleEvent legacy = event(EventType.INSURANCE, "2026-03-01", valid("2026-03-01", "2027-03-01"),
                new ScanDetails("X", List.of(), null));
        List<DocumentDeadline> items = DeadlinesPolicy.of(List.of(legacy), TODAY);
        assertTrue(items.stream().allMatch(d -> d.status() == DeadlineStatus.NOT_RECORDED));
        assertFalse(items.stream().anyMatch(d -> legacy.id().equals(d.eventId())));
    }

    @Test
    void eachKindMapsToItsValidityGroup() {
        assertEquals(List.of(ValidityGroup.ITP, ValidityGroup.RCA, ValidityGroup.CASCO, ValidityGroup.ROVINIETA,
                ValidityGroup.EXTINGUISHER, ValidityGroup.FIRST_AID),
                Arrays.stream(DocumentKind.values()).map(DocumentKind::group).toList());
    }
}
