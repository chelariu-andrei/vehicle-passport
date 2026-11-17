package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Cost figures over the entries of one period and one currency. All inputs may come in any order. */
public final class CostMetrics {

    static final int ESTIMATE_WINDOW_DAYS = 60;
    static final int ESTIMATE_MIN_ENTRIES = 3;

    private CostMetrics() {
    }

    /**
     * Per calendar month, oldest first. Distance is {@code max km - min km} over the month's entries plus the last
     * entry of the previous calendar month as anchor; null when that month has no entry.
     */
    public static List<MonthCost> monthly(List<FuelEntry> entries) {
        Map<YearMonth, List<FuelEntry>> byMonth = new TreeMap<>();
        for (FuelEntry e : sorted(entries)) {
            byMonth.computeIfAbsent(YearMonth.from(e.date()), m -> new ArrayList<>()).add(e);
        }
        List<MonthCost> out = new ArrayList<>();
        for (Map.Entry<YearMonth, List<FuelEntry>> m : byMonth.entrySet()) {
            List<FuelEntry> of = m.getValue();
            BigDecimal cost = BigDecimal.ZERO;
            BigDecimal quantity = BigDecimal.ZERO;
            int min = Integer.MAX_VALUE;
            int max = Integer.MIN_VALUE;
            for (FuelEntry e : of) {
                cost = cost.add(e.total());
                quantity = quantity.add(e.quantity());
                min = Math.min(min, e.odometerKm());
                max = Math.max(max, e.odometerKm());
            }
            Integer distance = null;
            List<FuelEntry> previous = byMonth.get(m.getKey().minusMonths(1));
            if (previous != null) {
                int anchorKm = previous.get(previous.size() - 1).odometerKm();
                distance = Math.max(max, anchorKm) - Math.min(min, anchorKm);
            }
            out.add(new MonthCost(m.getKey(), cost, quantity, of.size(), distance));
        }
        return List.copyOf(out);
    }

    /**
     * {@code Σ total of entries after the first / (lastKm - firstKm)}, 4 decimals HALF_UP; null with fewer than 2
     * entries or a span that is not positive.
     */
    public static BigDecimal costPerKm(List<FuelEntry> entries) {
        if (entries.size() < 2) {
            return null;
        }
        List<FuelEntry> sorted = sorted(entries);
        int span = sorted.get(sorted.size() - 1).odometerKm() - sorted.get(0).odometerKm();
        if (span <= 0) {
            return null;
        }
        BigDecimal cost = BigDecimal.ZERO;
        for (FuelEntry e : sorted.subList(1, sorted.size())) {
            cost = cost.add(e.total());
        }
        return cost.divide(BigDecimal.valueOf(span), 4, RoundingMode.HALF_UP);
    }

    /** {@code Σ total / Σ quantity}, 4 decimals HALF_UP; null without entries. */
    public static BigDecimal avgUnitPrice(List<FuelEntry> entries) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal quantity = BigDecimal.ZERO;
        for (FuelEntry e : entries) {
            total = total.add(e.total());
            quantity = quantity.add(e.quantity());
        }
        return quantity.signum() <= 0 ? null : total.divide(quantity, 4, RoundingMode.HALF_UP);
    }

    /**
     * {@code spentSoFar} is the total of entries dated in today's month. {@code projected} is the total of the last 60
     * days (today and the 59 days before, plus any entry dated after today) / 60 * days in today's month, 2 decimals
     * HALF_UP; null with fewer than 3 entries in that window.
     */
    public static MonthEstimate monthEstimate(List<FuelEntry> entries, LocalDate today) {
        YearMonth month = YearMonth.from(today);
        LocalDate windowStart = today.minusDays(ESTIMATE_WINDOW_DAYS - 1L);
        BigDecimal spent = BigDecimal.ZERO;
        BigDecimal windowTotal = BigDecimal.ZERO;
        int windowCount = 0;
        for (FuelEntry e : entries) {
            if (YearMonth.from(e.date()).equals(month)) {
                spent = spent.add(e.total());
            }
            if (!e.date().isBefore(windowStart)) {
                windowTotal = windowTotal.add(e.total());
                windowCount++;
            }
        }
        BigDecimal projected = windowCount < ESTIMATE_MIN_ENTRIES ? null
                : windowTotal.multiply(BigDecimal.valueOf(month.lengthOfMonth()))
                        .divide(BigDecimal.valueOf(ESTIMATE_WINDOW_DAYS), 2, RoundingMode.HALF_UP);
        return new MonthEstimate(month, spent.setScale(2, RoundingMode.HALF_UP), projected);
    }

    private static List<FuelEntry> sorted(List<FuelEntry> entries) {
        List<FuelEntry> out = new ArrayList<>(entries);
        out.sort(ConsumptionCalculator.CHRONOLOGICAL);
        return out;
    }
}
