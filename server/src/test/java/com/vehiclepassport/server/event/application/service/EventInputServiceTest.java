package com.vehiclepassport.server.event.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.CustomField;
import com.vehiclepassport.server.event.domain.model.EventAnnotations;
import com.vehiclepassport.server.event.domain.model.EventFacts;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

class EventInputServiceTest {

    private static final LocalDate DATE = LocalDate.parse("2026-01-10");

    private static EventInput input(DetailsView d, List<String> components, List<CustomFieldView> fields) {
        return new EventInput("insurance", DATE, null, BigDecimal.TEN, "RON", "n", null, DATE, DATE.plusDays(30), d,
                components, fields);
    }

    private static DetailsView details(String kind, String coverage, String insurer, String duration,
            String station, String result, String item) {
        return new DetailsView(kind, null, null, null, coverage, insurer, null, duration, station, result, item);
    }

    private static void refused(Executable call) {
        InvalidEventException e = assertThrows(InvalidEventException.class, call);
        assertEquals("validation-failed", e.code());
        assertEquals(400, e.kind().status());
    }

    @Test
    void a_legacy_input_has_no_details_and_empty_annotations() {
        EventInput legacy = new EventInput("SERVICE", DATE, 1000, BigDecimal.TEN, "RON", null, null, null, null,
                null, null, null);
        EventFacts f = EventInputService.facts(legacy);
        EventAnnotations a = EventInputService.annotations(legacy);
        assertEquals(EventType.SERVICE, f.type());
        assertNull(f.details());
        assertEquals(Set.of(), a.components());
        assertEquals(List.of(), a.customFields());
    }

    @Test
    void every_input_kind_maps_to_its_domain_record() {
        assertEquals(new InsuranceDetails(InsuranceCoverage.CASCO, "Allianz", null),
                EventInputService.details(details("INSURANCE", "casco", "Allianz", null, null, null, null)));
        assertEquals(new RovinietaDetails(RovinietaDuration.SEVEN_DAYS),
                EventInputService.details(details("ROVINIETA", null, null, "SEVEN_DAYS", null, null, null)));
        assertEquals(new ItpDetails("RAR", null),
                EventInputService.details(details("ITP", null, null, null, "RAR", null, null)));
        assertEquals(new SafetyEquipmentDetails(SafetyItem.FIRST_AID_KIT),
                EventInputService.details(details("SAFETY_EQUIPMENT", null, null, null, null, null, "FIRST_AID_KIT")));
    }

    @Test
    void components_and_custom_fields_are_kept() {
        EventAnnotations a = EventInputService.annotations(input(null, List.of("BRAKES", "ENGINE"),
                List.of(new CustomFieldView(" Layers ", "3"))));
        assertEquals(Set.of(Component.BRAKES, Component.ENGINE), a.components());
        assertEquals(List.of(new CustomField("Layers", "3")), a.customFields());
    }

    @Test
    void scan_details_from_a_client_are_refused() {
        refused(() -> EventInputService.details(DetailsView.scan("x", List.of(), null)));
    }

    @Test
    void unknown_or_missing_enum_values_are_refused() {
        refused(() -> EventInputService.details(details("WARRANTY", null, null, null, null, null, null)));
        refused(() -> EventInputService.details(details(null, null, null, null, null, null, null)));
        refused(() -> EventInputService.details(details("INSURANCE", "LIABILITY", "A", null, null, null, null)));
        refused(() -> EventInputService.details(details("INSURANCE", null, "A", null, null, null, null)));
        refused(() -> EventInputService.details(details("ROVINIETA", null, null, "TWO_DAYS", null, null, null)));
        refused(() -> EventInputService.details(details("ITP", null, null, null, null, "MAYBE", null)));
        refused(() -> EventInputService.details(details("SAFETY_EQUIPMENT", null, null, null, null, null, "AXE")));
        refused(() -> EventInputService.facts(new EventInput("CARWASH", DATE, 1, BigDecimal.ONE, "RON", null, null,
                null, null, null, null, null)));
        refused(() -> EventInputService.annotations(input(null, List.of("WINGS"), null)));
    }

    @Test
    void fields_of_another_kind_are_refused() {
        refused(() -> EventInputService.details(details("INSURANCE", "RCA", "A", "SEVEN_DAYS", null, null, null)));
        refused(() -> EventInputService.details(details("ITP", "RCA", null, null, "RAR", null, null)));
        refused(() -> EventInputService.details(new DetailsView("ROVINIETA", null, List.of(), null, null, null, null,
                "ONE_DAY", null, null, null)));
    }

    @Test
    void duplicates_and_null_elements_are_refused_not_thrown_as_npe() {
        refused(() -> EventInputService.annotations(input(null, List.of("BRAKES", "BRAKES"), null)));
        refused(() -> EventInputService.annotations(input(null, Arrays.asList("BRAKES", null), null)));
        refused(() -> EventInputService.annotations(input(null, null, Arrays.asList((CustomFieldView) null))));
        refused(() -> EventInputService.annotations(input(null, null, List.of(new CustomFieldView(null, "v")))));
    }
}
