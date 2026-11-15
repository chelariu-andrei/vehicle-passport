package com.vehiclepassport.server.scan.domain.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Rebuilds visual rows from OCR lines. A line joins a row when its vertical overlap with that
 * row's horizontally nearest line is at least half the shorter box's height. Comparing against
 * the nearest line (not the row's first line) keeps rows of a tilted photo apart.
 */
public final class OcrRows {

    private static final Comparator<OcrLine> READING_ORDER = Comparator
        .comparingDouble((OcrLine l) -> l.box().centerY())
        .thenComparingInt(l -> l.box().xMin())
        .thenComparingInt(l -> l.box().xMax())
        .thenComparingInt(l -> l.box().yMin())
        .thenComparingInt(l -> l.box().yMax())
        .thenComparing(OcrLine::text)
        .thenComparingDouble(OcrLine::score);

    private static final Comparator<OcrLine> LEFT_TO_RIGHT = Comparator
        .comparingInt((OcrLine l) -> l.box().xMin())
        .thenComparing(READING_ORDER);

    private OcrRows() {}

    /** Rows top to bottom, each left to right; the result does not depend on input order. */
    public static List<List<OcrLine>> rows(List<OcrLine> lines) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<OcrLine> sorted = new ArrayList<>(lines);
        sorted.sort(READING_ORDER);
        List<List<OcrLine>> rows = new ArrayList<>();
        for (OcrLine line : sorted) {
            List<OcrLine> best = null;
            double bestRatio = -1;
            for (List<OcrLine> row : rows) {
                OcrLine nearest = nearest(row, line);
                double ratio = overlapRatio(nearest.box(), line.box());
                if (ratio >= 0.5 && ratio > bestRatio) {
                    best = row;
                    bestRatio = ratio;
                }
            }
            if (best == null) {
                best = new ArrayList<>();
                rows.add(best);
            }
            best.add(line);
        }
        List<List<OcrLine>> result = new ArrayList<>(rows.size());
        for (List<OcrLine> row : rows) {
            row.sort(LEFT_TO_RIGHT);
            result.add(List.copyOf(row));
        }
        return List.copyOf(result);
    }

    private static OcrLine nearest(List<OcrLine> row, OcrLine line) {
        OcrLine nearest = row.get(0);
        for (OcrLine candidate : row) {
            int gap = horizontalGap(candidate.box(), line.box());
            int bestGap = horizontalGap(nearest.box(), line.box());
            if (gap < bestGap || (gap == bestGap
                    && Math.abs(candidate.box().centerY() - line.box().centerY())
                        < Math.abs(nearest.box().centerY() - line.box().centerY()))) {
                nearest = candidate;
            }
        }
        return nearest;
    }

    private static int horizontalGap(OcrBox a, OcrBox b) {
        return Math.max(0, Math.max(a.xMin(), b.xMin()) - Math.min(a.xMax(), b.xMax()));
    }

    /** Vertical overlap divided by the shorter height; 1 when a zero-height box lies inside the other. */
    private static double overlapRatio(OcrBox a, OcrBox b) {
        int overlap = Math.min(a.yMax(), b.yMax()) - Math.max(a.yMin(), b.yMin());
        int shorter = Math.min(a.height(), b.height());
        if (shorter == 0) {
            return overlap >= 0 ? 1.0 : 0.0;
        }
        return Math.max(0, overlap) / (double) shorter;
    }
}
