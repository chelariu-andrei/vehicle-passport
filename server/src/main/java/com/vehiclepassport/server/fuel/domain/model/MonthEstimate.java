package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.time.YearMonth;

/** Real spend of the current month and its projection; {@code projected} is null with too little history. */
public record MonthEstimate(YearMonth month, BigDecimal spentSoFar, BigDecimal projected) {
}
