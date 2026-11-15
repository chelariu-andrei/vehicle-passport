package com.vehiclepassport.server.vehicle.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.vehicle.domain.exception.InvalidVehicleDataException;
import com.vehiclepassport.server.vehicle.domain.model.Appearance;
import com.vehiclepassport.server.vehicle.domain.model.BodyType;
import com.vehiclepassport.server.vehicle.domain.model.GlassTint;
import com.vehiclepassport.server.vehicle.domain.model.PaintColor;
import com.vehiclepassport.server.vehicle.domain.model.PaintFinish;
import com.vehiclepassport.server.vehicle.domain.model.RimColor;
import com.vehiclepassport.server.vehicle.domain.model.WheelStyle;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AppearanceTest {

    @Test
    void enums_hold_exactly_the_contract_values() {
        assertEquals(List.of("HATCHBACK", "SEDAN", "ESTATE", "SUV", "COUPE", "MPV", "PICKUP"), names(BodyType.values()));
        assertEquals(List.of("WHITE", "BLACK", "SILVER", "GREY", "BLUE", "RED", "GREEN", "BEIGE", "BROWN", "YELLOW",
                "ORANGE", "GOLD"), names(PaintColor.values()));
        assertEquals(List.of("GLOSS", "METALLIC", "SATIN", "MATTE"), names(PaintFinish.values()));
        assertEquals(List.of("FIVE_SPOKE", "MULTI_SPOKE", "AERO"), names(WheelStyle.values()));
        assertEquals(List.of("SILVER", "BLACK", "BODY"), names(RimColor.values()));
        assertEquals(List.of("LIGHT", "DARK"), names(GlassTint.values()));
    }

    @Test
    void every_contract_value_parses_to_itself() {
        Arrays.stream(BodyType.values()).forEach(v -> assertSame(v, BodyType.parse(v.name())));
        Arrays.stream(PaintColor.values()).forEach(v -> assertSame(v, PaintColor.parse(v.name())));
        Arrays.stream(PaintFinish.values()).forEach(v -> assertSame(v, PaintFinish.parse(v.name())));
        Arrays.stream(WheelStyle.values()).forEach(v -> assertSame(v, WheelStyle.parse(v.name())));
        Arrays.stream(RimColor.values()).forEach(v -> assertSame(v, RimColor.parse(v.name())));
        Arrays.stream(GlassTint.values()).forEach(v -> assertSame(v, GlassTint.parse(v.name())));
    }

    @Test
    void null_parses_to_null() {
        assertNull(BodyType.parse(null));
        assertNull(GlassTint.parse(null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"BUGGY", "suv", ""})
    void unknown_body_type_is_refused(String raw) {
        InvalidVehicleDataException e = assertThrows(InvalidVehicleDataException.class, () -> BodyType.parse(raw));
        assertEquals("invalid-vehicle", e.code());
    }

    @ParameterizedTest
    @ValueSource(strings = {"red", "#FF0000", "#ff00", "ff0000"})
    void bad_hex_is_refused(String hex) {
        assertThrows(InvalidVehicleDataException.class,
                () -> new Appearance(null, PaintColor.RED, hex, null, null, null, null, null));
    }

    @Test
    void good_hex_is_kept() {
        assertEquals("#1c6b49",
                new Appearance(null, PaintColor.GREEN, "#1c6b49", null, null, null, null, null).colorHex());
    }

    @Test
    void empty_appearance_becomes_null() {
        assertNull(Appearance.orNull(new Appearance(null, null, null, null, null, null, null, null)));
        assertNull(Appearance.orNull(null));
    }

    @Test
    void non_empty_appearance_is_kept() {
        Appearance roofOnly = new Appearance(null, null, null, null, null, null, null, false);
        assertSame(roofOnly, Appearance.orNull(roofOnly));
    }

    private static List<String> names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).toList();
    }
}
