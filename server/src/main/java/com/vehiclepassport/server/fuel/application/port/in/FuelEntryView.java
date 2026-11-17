package com.vehiclepassport.server.fuel.application.port.in;

import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import com.vehiclepassport.server.fuel.domain.model.FuelUnit;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Mirrors {@code FuelEntryResponse}; {@code consumption} is set only on a fill-up closing an included segment. */
public record FuelEntryView(UUID id, LocalDate date, int odometerKm, FuelEntryType fuelType, BigDecimal quantity,
        FuelUnit unit, BigDecimal total, BigDecimal unitPrice, String currency, boolean fullTank,
        boolean missedPrevious, FuelGrade grade, ChargeType chargeType, String station, String note,
        BigDecimal consumption) {
}
