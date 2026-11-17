package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.time.YearMonth;

/** Spend of one calendar month; {@code distanceKm} is null without an anchor reading in the previous month. */
public record MonthCost(YearMonth month, BigDecimal cost, BigDecimal quantity, int entries, Integer distanceKm) {
}
