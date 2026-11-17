package com.vehiclepassport.server.fuel.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.fuel.domain.exception.InvalidFuelEntryException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class FuelEntryTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 17);

    private static FuelEntry create(FuelEntryType type, VehicleFuel vehicle, String quantity, String total,
            LocalDate date, FuelGrade grade, ChargeType charge) {
        return FuelEntry.create(UUID.randomUUID(), "WVWZZZ1JZXW000001", UUID.randomUUID(), UUID.randomUUID(), date,
                10_000, type, new BigDecimal(quantity), new BigDecimal(total), "RON", grade, charge, null, null, true,
                false, vehicle, TODAY, Instant.parse("2026-11-17T10:00:00Z"));
    }

    private static FuelEntry diesel(String quantity, String total) {
        return create(FuelEntryType.DIESEL, VehicleFuel.DIESEL, quantity, total, TODAY, null, null);
    }

    @Test
    void create_computes_unit_price_to_four_decimals() {
        assertEquals(new BigDecimal("7.5000"), diesel("40.0", "300.00").unitPrice());
        assertEquals(new BigDecimal("7.5000"), diesel("42.0", "315.00").unitPrice());
        assertEquals(new BigDecimal("8.1675"), diesel("38.2", "312.00").unitPrice());
    }

    @Test
    void rejects_non_positive_quantity() {
        assertThrows(InvalidFuelEntryException.class, () -> diesel("0", "10.00"));
        assertThrows(InvalidFuelEntryException.class, () -> diesel("-1", "10.00"));
    }

    @Test
    void rejects_negative_total() {
        assertThrows(InvalidFuelEntryException.class, () -> diesel("10", "-0.01"));
    }

    @Test
    void rejects_future_date_beyond_one_day() {
        assertThrows(InvalidFuelEntryException.class, () -> create(FuelEntryType.DIESEL, VehicleFuel.DIESEL, "10",
                "50", TODAY.plusDays(2), null, null));
    }

    @Test
    void accepts_tomorrow() {
        create(FuelEntryType.DIESEL, VehicleFuel.DIESEL, "10", "50", TODAY.plusDays(1), null, null);
    }

    @Test
    void rejects_grade_on_electric() {
        assertThrows(InvalidFuelEntryException.class, () -> create(FuelEntryType.ELECTRIC, VehicleFuel.ELECTRIC, "30",
                "40", TODAY, FuelGrade.PREMIUM, null));
    }

    @Test
    void rejects_charge_type_on_liquid_fuel() {
        assertThrows(InvalidFuelEntryException.class, () -> create(FuelEntryType.DIESEL, VehicleFuel.DIESEL, "30",
                "40", TODAY, null, ChargeType.HOME));
    }

    @Test
    void unit_follows_fuel_type() {
        assertEquals(FuelUnit.L, FuelEntryType.LPG.unit());
        assertEquals(FuelUnit.KWH, FuelEntryType.ELECTRIC.unit());
    }

    static Stream<Arguments> fuelTypeVsVehicle() {
        return Stream.of(
                Arguments.of(FuelEntryType.DIESEL, VehicleFuel.ELECTRIC, false),
                Arguments.of(FuelEntryType.PETROL, VehicleFuel.ELECTRIC, false),
                Arguments.of(FuelEntryType.LPG, VehicleFuel.ELECTRIC, false),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.DIESEL, false),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.PETROL, false),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.LPG, false),
                Arguments.of(FuelEntryType.DIESEL, VehicleFuel.DIESEL, true),
                Arguments.of(FuelEntryType.PETROL, VehicleFuel.PETROL, true),
                Arguments.of(FuelEntryType.LPG, VehicleFuel.PETROL, true),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.ELECTRIC, true),
                Arguments.of(FuelEntryType.PETROL, VehicleFuel.HYBRID, true),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.HYBRID, true),
                Arguments.of(FuelEntryType.DIESEL, VehicleFuel.OTHER, true),
                Arguments.of(FuelEntryType.ELECTRIC, VehicleFuel.OTHER, true));
    }

    @ParameterizedTest
    @MethodSource("fuelTypeVsVehicle")
    void fuel_type_vs_vehicle_fuel(FuelEntryType type, VehicleFuel vehicle, boolean allowed) {
        ChargeType charge = type == FuelEntryType.ELECTRIC ? ChargeType.HOME : null;
        if (allowed) {
            create(type, vehicle, "30", "40", TODAY, null, charge);
        } else {
            assertThrows(InvalidFuelEntryException.class, () -> create(type, vehicle, "30", "40", TODAY, null,
                    charge));
        }
    }
}
