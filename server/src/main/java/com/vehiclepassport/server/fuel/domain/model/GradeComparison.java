package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Weighted average consumption of the segments run on one grade. */
public record GradeComparison(FuelGrade grade, BigDecimal average, int segmentCount) {

    /**
     * One row per grade, in {@link FuelGrade} order, only when every grade has at least {@code minPerGrade} graded
     * segments; otherwise empty. Segments without a grade (mixed or untagged) are skipped.
     */
    public static List<GradeComparison> compare(List<ConsumptionSegment> segments, int minPerGrade) {
        Map<FuelGrade, List<ConsumptionSegment>> byGrade = new EnumMap<>(FuelGrade.class);
        for (ConsumptionSegment s : segments) {
            if (s.grade() != null) {
                byGrade.computeIfAbsent(s.grade(), g -> new ArrayList<>()).add(s);
            }
        }
        List<GradeComparison> out = new ArrayList<>();
        for (FuelGrade g : FuelGrade.values()) {
            List<ConsumptionSegment> of = byGrade.getOrDefault(g, List.of());
            if (of.isEmpty() || of.size() < minPerGrade) {
                return List.of();
            }
            out.add(new GradeComparison(g, ConsumptionCalculator.weightedAverage(of), of.size()));
        }
        return List.copyOf(out);
    }
}
