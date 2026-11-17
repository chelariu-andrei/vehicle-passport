package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Splits the entries of one fuel type into segments between consecutive full fill-ups. A segment is excluded when its
 * distance is below {@link #MIN_KM} (which also covers zero or negative distance) or when any entry after the opening
 * fill-up was marked {@code missedPrevious}. An excluded segment still re-anchors at its closing full fill-up.
 */
public final class ConsumptionCalculator {

    /** Chronological order of entries: date, then odometer, then creation time. */
    public static final Comparator<FuelEntry> CHRONOLOGICAL = Comparator.comparing(FuelEntry::date)
            .thenComparingInt(FuelEntry::odometerKm)
            .thenComparing(FuelEntry::createdAt, Comparator.nullsFirst(Comparator.naturalOrder()));

    static final int MIN_KM = 20;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private ConsumptionCalculator() {
    }

    public static ConsumptionResult calculate(List<FuelEntry> entriesOfOneFuelType) {
        List<FuelEntry> sorted = new ArrayList<>(entriesOfOneFuelType);
        sorted.sort(CHRONOLOGICAL);

        List<ConsumptionSegment> segments = new ArrayList<>();
        FuelEntry anchor = null;
        BigDecimal quantity = BigDecimal.ZERO;
        boolean missed = false;
        FuelGrade grade = null;
        boolean gradeMixed = false;

        for (FuelEntry e : sorted) {
            if (anchor == null) {
                // partial fill-ups before the first full one belong to no segment
                if (e.fullTank()) {
                    anchor = e;
                }
                continue;
            }
            quantity = quantity.add(e.quantity());
            missed |= e.missedPrevious();
            if (e.grade() == null || (grade != null && grade != e.grade())) {
                gradeMixed = true;
            } else {
                grade = e.grade();
            }
            if (!e.fullTank()) {
                continue;
            }
            int km = e.odometerKm() - anchor.odometerKm();
            if (!missed && km >= MIN_KM) {
                segments.add(new ConsumptionSegment(e.id(), e.date(), e.odometerKm(), quantity, km,
                        per100(quantity, km), gradeMixed ? null : grade));
            }
            anchor = e;
            quantity = BigDecimal.ZERO;
            missed = false;
            grade = null;
            gradeMixed = false;
        }
        return new ConsumptionResult(segments, weightedAverage(segments));
    }

    /** {@code Σ quantity / Σ km * 100}, 2 decimals HALF_UP; null for no segments. */
    public static BigDecimal weightedAverage(List<ConsumptionSegment> segments) {
        if (segments.isEmpty()) {
            return null;
        }
        BigDecimal quantity = BigDecimal.ZERO;
        long km = 0;
        for (ConsumptionSegment s : segments) {
            quantity = quantity.add(s.quantity());
            km += s.km();
        }
        return per100(quantity, km);
    }

    private static BigDecimal per100(BigDecimal quantity, long km) {
        return quantity.multiply(HUNDRED).divide(BigDecimal.valueOf(km), 2, RoundingMode.HALF_UP);
    }
}
