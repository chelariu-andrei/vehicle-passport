package com.vehiclepassport.server.event.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregates of a VIN's timeline (spec section 6).
 * <ul>
 * <li>{@code eventCount}, {@code countsByType} and {@code costByCurrency} cover the events matching the whole
 * filter.</li>
 * <li>{@code fromKm} and {@code toKm} come from every event with a reading in the period, whatever its type or
 * components. {@code fromKm} is null when it would be the same reading as {@code toKm}.</li>
 * <li>{@code years} cover every active event, unfiltered.</li>
 * </ul>
 * The constructor puts the values in canonical form: types with a zero count are dropped and the rest kept in
 * declaration order; amounts have two decimals and are sorted by amount descending, then by currency; years are
 * distinct and newest first.
 */
public record TimelineSummary(long eventCount, Map<EventType, Long> countsByType,
        Map<String, BigDecimal> costByCurrency, Integer fromKm, Integer toKm, List<Integer> years) {

    public TimelineSummary {
        EnumMap<EventType, Long> counts = new EnumMap<>(EventType.class);
        if (countsByType != null) {
            countsByType.forEach((type, count) -> {
                if (count != null && count > 0) {
                    counts.put(type, count);
                }
            });
        }
        countsByType = Collections.unmodifiableMap(counts);
        Map<String, BigDecimal> costs = new LinkedHashMap<>();
        if (costByCurrency != null) {
            costByCurrency.entrySet().stream()
                    .map(e -> Map.entry(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP)))
                    .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()
                            .thenComparing(Map.Entry.comparingByKey()))
                    .forEach(e -> costs.put(e.getKey(), e.getValue()));
        }
        costByCurrency = Collections.unmodifiableMap(costs);
        years = years == null ? List.of()
                : years.stream().distinct().sorted(Comparator.reverseOrder()).toList();
    }

    /** {@code toKm - fromKm}; null when fewer than two readings back it. */
    public Integer distanceKm() {
        return fromKm == null || toKm == null ? null : toKm - fromKm;
    }
}
