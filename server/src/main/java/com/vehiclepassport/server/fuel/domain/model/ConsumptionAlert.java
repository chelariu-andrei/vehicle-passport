package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** A sudden consumption increase: the latest included segment against the mean of the ones before it. */
public record ConsumptionAlert(BigDecimal latest, BigDecimal baseline, BigDecimal deltaPct, UUID entryId) {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * Fires when at least {@code minBaseline} of the up to {@code window} segments before the latest exist and the
     * latest is strictly above their mean by more than {@code thresholdPct} percent. Never fires on a decrease.
     *
     * @param chronological included segments, oldest first
     */
    public static Optional<ConsumptionAlert> detect(List<ConsumptionSegment> chronological, int window,
            int minBaseline, BigDecimal thresholdPct) {
        int n = chronological.size();
        if (n < 2) {
            return Optional.empty();
        }
        ConsumptionSegment last = chronological.get(n - 1);
        List<ConsumptionSegment> baseline = chronological.subList(Math.max(0, n - 1 - window), n - 1);
        if (baseline.isEmpty() || baseline.size() < minBaseline) {
            return Optional.empty();
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (ConsumptionSegment s : baseline) {
            sum = sum.add(s.per100km());
        }
        BigDecimal mean = sum.divide(BigDecimal.valueOf(baseline.size()), MathContext.DECIMAL64);
        if (mean.signum() <= 0) {
            return Optional.empty();
        }
        BigDecimal limit = mean.multiply(BigDecimal.ONE.add(thresholdPct.divide(HUNDRED, MathContext.DECIMAL64)));
        BigDecimal latest = last.per100km();
        if (latest.compareTo(limit) <= 0) {
            return Optional.empty();
        }
        BigDecimal deltaPct = latest.subtract(mean).multiply(HUNDRED).divide(mean, 1, RoundingMode.HALF_UP);
        return Optional.of(new ConsumptionAlert(latest.setScale(2, RoundingMode.HALF_UP),
                mean.setScale(2, RoundingMode.HALF_UP), deltaPct, last.closingEntryId()));
    }
}
