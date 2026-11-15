package com.vehiclepassport.server.vehicle.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.vehicle.domain.model.Appearance;
import com.vehiclepassport.server.vehicle.domain.model.BodyType;
import com.vehiclepassport.server.vehicle.domain.model.GlassTint;
import com.vehiclepassport.server.vehicle.domain.model.PaintColor;
import com.vehiclepassport.server.vehicle.domain.model.PaintFinish;
import com.vehiclepassport.server.vehicle.domain.model.Plate;
import com.vehiclepassport.server.vehicle.domain.model.RimColor;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import com.vehiclepassport.server.vehicle.domain.model.WheelStyle;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class VehicleTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-10T10:00:00Z"), ZoneOffset.UTC);
    private static final Vin VIN = Vin.of("WVWZZZ1JZXW000001");
    private static final Appearance LOOK = new Appearance(BodyType.SUV, PaintColor.BLUE, null, PaintFinish.MATTE,
            WheelStyle.AERO, RimColor.BLACK, GlassTint.DARK, true);

    @Test
    void without_plate_keeps_everything_else() {
        Vehicle v = Vehicle.of(VIN, "Dacia", "Duster", "1.5 dCi", 2020, "DIESEL", new Plate("B 123 ABC"), LOOK, CLOCK);
        Vehicle sold = v.withoutPlate();
        assertNull(sold.plate());
        assertEquals(LOOK, sold.appearance());
        assertEquals(v.vin(), sold.vin());
        assertEquals(v.make(), sold.make());
        assertEquals(v.model(), sold.model());
        assertEquals(v.engine(), sold.engine());
        assertEquals(v.year(), sold.year());
        assertEquals(v.fuel(), sold.fuel());
    }

    @Test
    void empty_appearance_is_stored_as_null() {
        Appearance empty = new Appearance(null, null, null, null, null, null, null, null);
        assertNull(Vehicle.of(VIN, "Dacia", "Duster", null, 2020, "DIESEL", null, empty, CLOCK).appearance());
    }

    @Test
    void keeps_plate_and_appearance() {
        Vehicle v = Vehicle.of(VIN, "Dacia", "Duster", null, 2020, "DIESEL", new Plate("B 123 ABC"), LOOK, CLOCK);
        assertEquals("B 123 ABC", v.plate().value());
        assertEquals(LOOK, v.appearance());
    }
}
