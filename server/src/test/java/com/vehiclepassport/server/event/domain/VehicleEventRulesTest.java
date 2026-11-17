package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.DocumentedEventImmutableException;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.CustomField;
import com.vehiclepassport.server.event.domain.model.EventAnnotations;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventFacts;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.Validity;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** The per-type rule table of spec §5.1, one row per case. */
class VehicleEventRulesTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), ZoneOffset.UTC);
    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final UUID USER = UUID.randomUUID();
    private static final UUID PERIOD = UUID.randomUUID();
    private static final LocalDate DATE = LocalDate.parse("2026-01-10");
    private static final EventAnnotations NONE = new EventAnnotations("n", Set.of(), List.of());
    private static final ScanDetails SCAN = new ScanDetails("Auto Service SRL",
            List.of(new PartLine("Oil filter", BigDecimal.ONE, new BigDecimal("45.50"))), new BigDecimal("100"));
    private static final InsuranceDetails RCA = new InsuranceDetails(InsuranceCoverage.RCA, "Allianz", "P-1");

    /** A row: build the event; when {@code refused} is set, building must throw it, otherwise {@code then} checks it. */
    record Case(String name, Supplier<VehicleEvent> build, Class<? extends RuntimeException> refused,
            Consumer<VehicleEvent> then) {

        @Override
        public String toString() {
            return name;
        }
    }

    private static Case refused(String name, Supplier<VehicleEvent> build) {
        return new Case(name, build, InvalidEventException.class, e -> { });
    }

    private static Case accepted(String name, Supplier<VehicleEvent> build, Consumer<VehicleEvent> then) {
        return new Case(name, build, null, then);
    }

    private static EventFacts facts(EventType type, Integer km, LocalDate from, LocalDate until, EventDetails d) {
        return facts(type, km, null, from, until, d);
    }

    private static EventFacts facts(EventType type, Integer km, String label, LocalDate from, LocalDate until,
            EventDetails d) {
        return new EventFacts(type, DATE, km, new BigDecimal("450.00"), "RON", label, from, until, d);
    }

    private static VehicleEvent manual(EventFacts f) {
        return VehicleEvent.manual(VIN, f, NONE, USER, PERIOD, CLOCK);
    }

    private static VehicleEvent manual(EventFacts f, EventAnnotations a) {
        return VehicleEvent.manual(VIN, f, a, USER, PERIOD, CLOCK);
    }

    private static VehicleEvent documented(EventFacts f) {
        return VehicleEvent.documented(VIN, f, NONE, USER, PERIOD, CLOCK);
    }

    private static EventFacts scannedService() {
        return facts(EventType.SERVICE, 120000, null, null, SCAN);
    }

    private static List<CustomField> fields(int n) {
        return IntStream.range(0, n).mapToObj(i -> new CustomField("L" + i, "v")).toList();
    }

    static Stream<Case> rows() {
        return Stream.of(
                refused("insuranceWithoutDetailsRefused", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1), null))),
                refused("insuranceUntilBeforeFromRefused", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.minusDays(1), RCA))),
                refused("rovinietaWithClientUntilRefused", () -> manual(
                        facts(EventType.ROVINIETA, null, DATE, DATE.plusDays(6),
                                new RovinietaDetails(RovinietaDuration.SEVEN_DAYS)))),
                accepted("rovinietaUntilComputed", () -> manual(
                        facts(EventType.ROVINIETA, null, LocalDate.parse("2026-01-15"), null,
                                new RovinietaDetails(RovinietaDuration.TWELVE_MONTHS))),
                        e -> assertEquals(new Validity(LocalDate.parse("2026-01-15"),
                                LocalDate.parse("2027-01-14")), e.validity())),
                accepted("itpUntilStoredWithFromEqualDate", () -> manual(
                        facts(EventType.ITP, 120000, null, LocalDate.parse("2027-01-10"), null)),
                        e -> assertEquals(new Validity(DATE, LocalDate.parse("2027-01-10")), e.validity())),
                accepted("itpWithoutUntilHasNoValidity", () -> manual(
                        facts(EventType.ITP, 120000, null, null, new ItpDetails(" RAR ", ItpResult.PASSED))),
                        e -> {
                            assertNull(e.validity());
                            assertEquals(new ItpDetails("RAR", ItpResult.PASSED), e.details());
                        }),
                refused("itpWithClientFromRefused", () -> manual(
                        facts(EventType.ITP, 120000, DATE, LocalDate.parse("2027-01-10"), null))),
                refused("serviceWithDetailsRefused", () -> manual(
                        facts(EventType.SERVICE, 120000, null, null, RCA))),
                refused("serviceWithValidityRefused", () -> manual(
                        facts(EventType.SERVICE, 120000, null, DATE, null))),
                refused("serviceWithoutKmRefused", () -> manual(
                        facts(EventType.SERVICE, null, null, null, null))),
                refused("negativeKmRefused", () -> manual(
                        facts(EventType.INSURANCE, -1, DATE, DATE.plusYears(1), RCA))),
                accepted("insuranceWithoutKmAccepted", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1).minusDays(1), RCA)),
                        e -> {
                            assertNull(e.odometerKm());
                            assertEquals(new Validity(DATE, DATE.plusYears(1).minusDays(1)), e.validity());
                        }),
                accepted("insuranceFromAfterDateAccepted", () -> manual(
                        facts(EventType.INSURANCE, null, LocalDate.parse("2026-03-01"),
                                LocalDate.parse("2027-02-28"), RCA)),
                        e -> assertEquals(LocalDate.parse("2026-03-01"), e.validity().validFrom())),
                refused("insuranceWithRovinietaDetailsRefused", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1),
                                new RovinietaDetails(RovinietaDuration.ONE_DAY)))),
                refused("insuranceWithBlankInsurerRefused", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1),
                                new InsuranceDetails(InsuranceCoverage.CASCO, "  ", null)))),
                refused("insuranceWithLongPolicyRefused", () -> manual(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1),
                                new InsuranceDetails(InsuranceCoverage.CASCO, "Allianz", "p".repeat(61))))),
                refused("otherWithoutLabelRefused", () -> manual(
                        facts(EventType.OTHER, null, null, null, null))),
                accepted("otherLabelTrimmed", () -> manual(
                        facts(EventType.OTHER, null, "  Car wash ", null, null, null)),
                        e -> assertEquals("Car wash", e.customLabel())),
                refused("otherLabelOf61CharsRefused", () -> manual(
                        facts(EventType.OTHER, null, "x".repeat(61), null, null, null))),
                refused("labelOnServiceRefused", () -> manual(
                        facts(EventType.SERVICE, 120000, "Oil", null, null, null))),
                refused("elevenCustomFieldsRefused", () -> manual(
                        facts(EventType.SERVICE, 120000, null, null, null),
                        new EventAnnotations("n", Set.of(), fields(11)))),
                accepted("tenCustomFieldsAndSortedComponentsAccepted", () -> manual(
                        facts(EventType.SERVICE, 120000, null, null, null),
                        new EventAnnotations("n", Set.of(Component.OTHER, Component.BRAKES, Component.ENGINE),
                                fields(10))),
                        e -> {
                            assertEquals(10, e.customFields().size());
                            assertEquals(List.of(Component.ENGINE, Component.BRAKES, Component.OTHER),
                                    List.copyOf(e.components()));
                        }),
                refused("manualWithScanDetailsRefused", () -> manual(scannedService())),
                accepted("documentedAcceptsAnnotationChanges", () -> documented(scannedService()).edited(
                        scannedService(), new EventAnnotations("new notes", Set.of(Component.FLUIDS),
                                List.of(new CustomField("Oil", "5W-30"))), CLOCK),
                        e -> {
                            assertEquals("new notes", e.notes());
                            assertEquals(Set.of(Component.FLUIDS), e.components());
                            assertEquals(List.of(new CustomField("Oil", "5W-30")), e.customFields());
                            assertEquals(EvidenceLevel.DOCUMENTED, e.evidence());
                            assertEquals(SCAN, e.details());
                        }),
                new Case("documentedRefusesCostChange", () -> documented(scannedService()).edited(
                        new EventFacts(EventType.SERVICE, DATE, 120000, new BigDecimal("451"), "RON", null, null,
                                null, SCAN), NONE, CLOCK),
                        DocumentedEventImmutableException.class, e -> { }),
                refused("safetyEquipmentWithoutUntilRefused", () -> manual(
                        facts(EventType.SAFETY_EQUIPMENT, null, null, null,
                                new SafetyEquipmentDetails(SafetyItem.FIRE_EXTINGUISHER)))),
                refused("safetyEquipmentUntilBeforeDateRefused", () -> manual(
                        facts(EventType.SAFETY_EQUIPMENT, null, null, DATE.minusDays(1),
                                new SafetyEquipmentDetails(SafetyItem.FIRST_AID_KIT)))),
                accepted("safetyEquipmentUntilStoredWithFromEqualDate", () -> manual(
                        facts(EventType.SAFETY_EQUIPMENT, null, null, LocalDate.parse("2028-01-01"),
                                new SafetyEquipmentDetails(SafetyItem.FIRST_AID_KIT))),
                        e -> assertEquals(new Validity(DATE, LocalDate.parse("2028-01-01")), e.validity())),
                accepted("documentedServiceAcceptsScanDetails", () -> documented(scannedService()),
                        e -> {
                            assertEquals(SCAN, e.details());
                            assertEquals(EvidenceLevel.DOCUMENTED, e.evidence());
                        }),
                accepted("documentedServiceAcceptsNoDetails", () -> documented(
                        facts(EventType.REPAIR, 120000, null, null, null)),
                        e -> assertNull(e.details())),
                refused("documentedItpRequiresItpDetails", () -> documented(
                        facts(EventType.ITP, 120000, null, null, null))),
                accepted("documentedItpWithItpDetailsAccepted", () -> documented(
                        facts(EventType.ITP, 120000, null, LocalDate.parse("2027-01-10"),
                                new ItpDetails("Auto Service SRL", null))),
                        e -> assertEquals(new Validity(DATE, LocalDate.parse("2027-01-10")), e.validity())),
                refused("documentedItpWithScanDetailsRefused", () -> documented(
                        facts(EventType.ITP, 120000, null, null, SCAN))),
                refused("documentedInsuranceWithScanDetailsRefused", () -> documented(
                        facts(EventType.INSURANCE, null, DATE, DATE.plusYears(1), SCAN))));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rows")
    void rule(Case c) {
        if (c.refused() != null) {
            assertThrows(c.refused(), c.build()::get);
        } else {
            c.then().accept(c.build().get());
        }
    }
}
