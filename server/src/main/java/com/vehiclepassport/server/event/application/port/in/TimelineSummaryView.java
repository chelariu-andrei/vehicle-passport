package com.vehiclepassport.server.event.application.port.in;

import java.util.List;

/**
 * {@code countsByType} holds only types with a count above zero; {@code costByCurrency} is sorted by amount,
 * descending, each amount with two decimals; {@code distanceKm} is null when fewer than two readings back it;
 * {@code years} are newest first.
 */
public record TimelineSummaryView(long eventCount, List<TypeCountView> countsByType,
        List<CurrencyAmountView> costByCurrency, Integer distanceKm, Integer fromKm, Integer toKm,
        List<Integer> years) {
}
