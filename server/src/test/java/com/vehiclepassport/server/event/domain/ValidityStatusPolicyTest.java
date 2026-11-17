package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.Validity;
import com.vehiclepassport.server.event.domain.model.ValidityGroup;
import com.vehiclepassport.server.event.domain.model.ValidityStatus;
import com.vehiclepassport.server.event.domain.model.ValidityStatusPolicy;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ValidityStatusPolicyTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-16");
    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");

    private static VehicleEvent event(UUID id, EventType type, String date, Validity validity, EventDetails details,
            Instant createdAt) {
        return new VehicleEvent(id, "WVWZZZ1JZXW000001", type, LocalDate.parse(date), null, BigDecimal.TEN, "RON",
                null, null, validity, details, Set.of(), List.of(), EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL,
                UUID.randomUUID(), UUID.randomUUID(), null, createdAt, null);
    }

    private static Validity valid(String from, String until) {
        return new Validity(LocalDate.parse(from), until == null ? null : LocalDate.parse(until));
    }

    private static VehicleEvent insurance(InsuranceCoverage coverage, String from, String until) {
        return event(UUID.randomUUID(), EventType.INSURANCE, from, valid(from, until),
                new InsuranceDetails(coverage, "Allianz", null), T0);
    }

    private static VehicleEvent equipment(SafetyItem item, String date, String until) {
        return event(UUID.randomUUID(), EventType.SAFETY_EQUIPMENT, date, valid(date, until),
                new SafetyEquipmentDetails(item), T0);
    }

    private static VehicleEvent rcaUntil(String until) {
        return insurance(InsuranceCoverage.RCA, "2026-01-01", until);
    }

    private static ValidityStatus currentStatus(VehicleEvent e, LocalDate today) {
        return ValidityStatusPolicy.status(e, true, today);
    }

    @Test
    void olderSameGroupSuperseded() {
        VehicleEvent older = insurance(InsuranceCoverage.RCA, "2024-11-01", "2025-10-31");
        VehicleEvent newer = insurance(InsuranceCoverage.RCA, "2025-11-01", "2026-12-01");

        Set<UUID> current = ValidityStatusPolicy.currentIds(List.of(newer, older));

        assertEquals(Set.of(newer.id()), current);
        assertEquals(ValidityStatus.SUPERSEDED, ValidityStatusPolicy.status(older, false, TODAY));
        assertEquals(ValidityStatus.EXPIRING, ValidityStatusPolicy.status(newer, true, TODAY));
    }

    @Test
    void rcaAndCascoSeparate() {
        VehicleEvent casco = insurance(InsuranceCoverage.CASCO, "2025-01-01", "2025-12-31");
        VehicleEvent rca = insurance(InsuranceCoverage.RCA, "2026-11-01", "2027-10-31");

        assertEquals(Optional.of(ValidityGroup.CASCO), ValidityStatusPolicy.group(casco));
        assertEquals(Optional.of(ValidityGroup.RCA), ValidityStatusPolicy.group(rca));
        assertEquals(Set.of(casco.id(), rca.id()), ValidityStatusPolicy.currentIds(List.of(casco, rca)));
        assertEquals(ValidityStatus.EXPIRED, currentStatus(casco, TODAY));
        assertEquals(ValidityStatus.VALID, currentStatus(rca, TODAY));
    }

    @Test
    void extinguisherAndFirstAidSeparate() {
        VehicleEvent extinguisher = equipment(SafetyItem.FIRE_EXTINGUISHER, "2025-01-01", "2026-01-01");
        VehicleEvent kit = equipment(SafetyItem.FIRST_AID_KIT, "2026-05-01", "2027-05-01");

        assertEquals(Optional.of(ValidityGroup.EXTINGUISHER), ValidityStatusPolicy.group(extinguisher));
        assertEquals(Optional.of(ValidityGroup.FIRST_AID), ValidityStatusPolicy.group(kit));
        assertEquals(Set.of(extinguisher.id(), kit.id()),
                ValidityStatusPolicy.currentIds(List.of(extinguisher, kit)));
        assertEquals(ValidityStatus.EXPIRED, currentStatus(extinguisher, TODAY));
        assertEquals(ValidityStatus.VALID, currentStatus(kit, TODAY));
    }

    @Test
    void tieBrokenByCreatedAtThenId() {
        Validity same = valid("2026-01-15", "2027-01-14");
        RovinietaDetails twelve = new RovinietaDetails(RovinietaDuration.TWELVE_MONTHS);
        VehicleEvent earlier = event(UUID.randomUUID(), EventType.ROVINIETA, "2026-01-15", same, twelve, T0);
        VehicleEvent later = event(UUID.randomUUID(), EventType.ROVINIETA, "2026-01-10", same, twelve,
                T0.plusSeconds(1));
        assertEquals(Set.of(later.id()), ValidityStatusPolicy.currentIds(List.of(later, earlier)),
                "same validFrom: the later createdAt wins, whatever the event date");

        // Same validFrom and createdAt: the higher id wins, compared as Postgres orders uuid (unsigned bytes).
        VehicleEvent low = event(UUID.fromString("7fffffff-0000-0000-0000-000000000000"), EventType.ROVINIETA,
                "2026-01-15", same, twelve, T0);
        VehicleEvent high = event(UUID.fromString("80000000-0000-0000-0000-000000000000"), EventType.ROVINIETA,
                "2026-01-15", same, twelve, T0);
        assertEquals(Set.of(high.id()), ValidityStatusPolicy.currentIds(List.of(high, low)));
        assertEquals(Set.of(high.id()), ValidityStatusPolicy.currentIds(List.of(low, high)));
    }

    @Test
    void itpWithoutUntilUnknown() {
        VehicleEvent manual = event(UUID.randomUUID(), EventType.ITP, "2026-03-01", null,
                new ItpDetails("RAR Iasi", null), T0);
        assertEquals(Optional.of(ValidityGroup.ITP), ValidityStatusPolicy.group(manual));
        assertEquals(ValidityStatus.UNKNOWN, currentStatus(manual, TODAY));

        // Rows scanned before typed details hold scan details and no validity; they still count as ITPs.
        VehicleEvent legacy = event(UUID.randomUUID(), EventType.ITP, "2025-03-01", null,
                new ScanDetails("RAR Iasi", List.of(), null), T0);
        VehicleEvent bare = event(UUID.randomUUID(), EventType.ITP, "2024-03-01", null, null, T0);
        assertEquals(Optional.of(ValidityGroup.ITP), ValidityStatusPolicy.group(legacy));
        assertEquals(Optional.of(ValidityGroup.ITP), ValidityStatusPolicy.group(bare));
        assertEquals(Set.of(manual.id()), ValidityStatusPolicy.currentIds(List.of(legacy, manual, bare)),
                "without validity, an ITP counts from its event date");
        assertEquals(ValidityStatus.UNKNOWN, currentStatus(legacy, TODAY));
        assertEquals(ValidityStatus.SUPERSEDED, ValidityStatusPolicy.status(legacy, false, TODAY));
    }

    @Test
    void expiringAt30Days() {
        assertEquals(ValidityStatusPolicy.EXPIRING_DAYS, 30);
        assertEquals(ValidityStatus.EXPIRING, currentStatus(rcaUntil("2026-12-16"), TODAY));
        assertEquals(ValidityStatus.VALID, currentStatus(rcaUntil("2026-12-17"), TODAY));
    }

    @Test
    void expiredDayAfter() {
        VehicleEvent rca = rcaUntil("2026-11-16");
        assertEquals(ValidityStatus.EXPIRING, currentStatus(rca, TODAY));
        assertEquals(ValidityStatus.EXPIRED, currentStatus(rca, TODAY.plusDays(1)));
    }

    @Test
    void serviceHasNoStatus() {
        VehicleEvent service = event(UUID.randomUUID(), EventType.SERVICE, "2026-03-01", null, null, T0);
        VehicleEvent other = event(UUID.randomUUID(), EventType.OTHER, "2026-03-01", null, null, T0);
        assertEquals(Optional.empty(), ValidityStatusPolicy.group(service));
        assertNull(ValidityStatusPolicy.status(service, false, TODAY));
        assertNull(ValidityStatusPolicy.status(other, true, TODAY));
        assertEquals(Set.of(), ValidityStatusPolicy.currentIds(List.of(service, other)));

        // Legacy INSURANCE or SAFETY_EQUIPMENT rows without typed details belong to no group and never throw.
        VehicleEvent untypedInsurance = event(UUID.randomUUID(), EventType.INSURANCE, "2025-03-01", null,
                new ScanDetails("X", List.of(), null), T0);
        VehicleEvent untypedKit = event(UUID.randomUUID(), EventType.SAFETY_EQUIPMENT, "2025-03-01", null, null, T0);
        assertEquals(Optional.empty(), ValidityStatusPolicy.group(untypedInsurance));
        assertEquals(Optional.empty(), ValidityStatusPolicy.group(untypedKit));
        assertNull(ValidityStatusPolicy.status(untypedInsurance, false, TODAY));
        assertEquals(Set.of(), ValidityStatusPolicy.currentIds(List.of(untypedInsurance, untypedKit)));
    }
}
