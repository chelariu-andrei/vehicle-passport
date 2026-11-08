package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AddEventCommand(UUID userId, String vin, String type, LocalDate date, int odometerKm,
        BigDecimal costAmount, String currency, String notes) {
}
