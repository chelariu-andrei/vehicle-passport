package com.vehiclepassport.server.fuel.application.port.in;

import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** A fill-up as the owner states it; {@code entryId} is null on add and names the entry to replace on update. */
public record FuelEntryCommand(UUID userId, String vin, UUID entryId, LocalDate date, int odometerKm,
        FuelEntryType fuelType, BigDecimal quantity, BigDecimal total, String currency, boolean fullTank,
        boolean missedPrevious, FuelGrade grade, ChargeType chargeType, String station, String note) {
}
