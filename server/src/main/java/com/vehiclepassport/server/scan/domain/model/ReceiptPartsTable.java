package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Reads the materials table of a deviz from OCR rows. The header row is the first row holding both
 * a name column and a value column; each body cell belongs to the header cell whose x-range it
 * overlaps most (unrecognised header cells such as {@code Reper} or {@code Nr. bon} still claim
 * their cells, which are then ignored). The table ends at the first row whose first cell is a
 * totals or VAT label. Without a header the table is not parsed and parts stay empty.
 *
 * <p>Row rules (plan P4-P6): {@code price} is the line value; no quantity column gives
 * {@code qty = null}, a blank quantity cell gives 1, an unreadable one skips the row with
 * {@link ScanWarning#PART_ROW_SKIPPED}. A numeric cell read below 0.50 drops the row with
 * {@link ScanWarning#LOW_CONFIDENCE_READ}; a low-score name is kept. {@code qty x unit price}
 * differing from the value by more than 0.01 adds {@link ScanWarning#PART_LINE_MISMATCH}.
 */
public final class ReceiptPartsTable {

    // Header labels, folded (see OcrText.fold) and unique across columns. A new header wording is
    // a new entry here. A label matches the start of a header cell, so "denumire" also covers
    // "denumire material".
    private static final List<String> NAME_LABELS = List.of("denumire");
    private static final List<String> QTY_LABELS = List.of("cantitate", "cant", "buc");
    private static final List<String> UNIT_PRICE_LABELS = List.of("pret unitar");
    private static final List<String> VALUE_LABELS = List.of("valoare");
    /** First cell of the row that ends the table: the totals block or VAT. */
    private static final List<String> END_LABELS = List.of("total", "tva");

    private static final int NAME_MAX = 120;
    private static final int MAX_PARTS = 100;
    private static final double MIN_NUMERIC_SCORE = 0.50;
    private static final double FUZZY_FACTOR = 0.7;
    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern CURRENCY = Pattern.compile("(?i)(?:lei|ron)\\.?");

    private enum Column { NAME, QTY, UNIT_PRICE, VALUE }

    /** Label to column, in declaration order (deterministic tie-breaking in matchLabel). */
    private static final Map<String, Column> HEADER_LABELS = headerLabels();
    private static final List<String> ALL_HEADER_LABELS = List.copyOf(HEADER_LABELS.keySet());

    /** {@code parts} is {@code (null, 0.0)} when no header row is found. */
    public record Outcome(ExtractedField<List<ExtractedPart>> parts, List<ScanWarning> warnings) {
        public Outcome {
            warnings = List.copyOf(warnings);
        }
    }

    private ReceiptPartsTable() {}

    /** {@code rows} as built by {@link OcrRows#rows}: top to bottom, each left to right. */
    public static Outcome parse(List<List<OcrLine>> rows) {
        if (rows == null) {
            throw new IllegalArgumentException("rows are required");
        }
        for (int r = 0; r < rows.size(); r++) {
            Optional<Header> header = Header.of(rows.get(r));
            if (header.isPresent()) {
                return body(header.get(), rows.subList(r + 1, rows.size()));
            }
        }
        return new Outcome(new ExtractedField<>(null, 0.0), List.of());
    }

    private static Outcome body(Header header, List<List<OcrLine>> rows) {
        Set<ScanWarning> warnings = new LinkedHashSet<>();
        List<ExtractedPart> parts = new ArrayList<>();
        double confidence = header.score();
        for (List<OcrLine> row : rows) {
            if (row.isEmpty()) {
                continue;
            }
            if (OcrText.matchLabel(OcrText.fold(row.get(0).text()), END_LABELS).isPresent()) {
                break;
            }
            Map<Column, List<OcrLine>> cells = header.assign(row);
            if (cells.isEmpty()) {
                continue; // nothing under a known column, e.g. only a Reper number
            }
            Optional<Kept> kept = read(header, cells, warnings);
            if (kept.isEmpty()) {
                continue;
            }
            if (parts.size() == MAX_PARTS) {
                warnings.add(ScanWarning.PART_ROW_SKIPPED);
                break;
            }
            parts.add(kept.get().part());
            confidence = Math.min(confidence, kept.get().score());
        }
        double factor = header.fuzzy() ? FUZZY_FACTOR : 1.0;
        return new Outcome(new ExtractedField<>(List.copyOf(parts), confidence * factor), List.copyOf(warnings));
    }

    private static Optional<Kept> read(Header header, Map<Column, List<OcrLine>> cells, Set<ScanWarning> warnings) {
        List<OcrLine> nameCells = cells.getOrDefault(Column.NAME, List.of());
        String name = OcrText.clean(joined(nameCells), NAME_MAX);
        Segment value = money(cells.getOrDefault(Column.VALUE, List.of()));
        if (name.isEmpty() || !value.valid() || value.value() == null) {
            warnings.add(ScanWarning.PART_ROW_SKIPPED);
            return Optional.empty();
        }
        if (value.score() < MIN_NUMERIC_SCORE) {
            warnings.add(ScanWarning.LOW_CONFIDENCE_READ);
            return Optional.empty();
        }
        double score = Math.min(minScore(nameCells), value.score());

        BigDecimal qty = null;
        boolean qtyRead = false;
        if (header.has(Column.QTY)) {
            Segment q = money(cells.getOrDefault(Column.QTY, List.of()));
            if (!q.valid()) {
                warnings.add(ScanWarning.PART_ROW_SKIPPED);
                return Optional.empty();
            }
            if (q.value() == null) {
                qty = BigDecimal.ONE; // P5: column present, cell blank
            } else if (q.score() < MIN_NUMERIC_SCORE) {
                warnings.add(ScanWarning.LOW_CONFIDENCE_READ);
                return Optional.empty();
            } else {
                qty = q.value();
                qtyRead = true;
                score = Math.min(score, q.score());
            }
        }

        // P6: the unit price only checks the row; it is never part of the result.
        Segment unit = money(cells.getOrDefault(Column.UNIT_PRICE, List.of()));
        if (qtyRead && unit.valid() && unit.value() != null && unit.score() >= MIN_NUMERIC_SCORE
                && qty.multiply(unit.value()).subtract(value.value()).abs().compareTo(TOLERANCE) > 0) {
            warnings.add(ScanWarning.PART_LINE_MISMATCH);
        }
        return Optional.of(new Kept(new ExtractedPart(name, qty, value.value()), score));
    }

    // ---- cells ------------------------------------------------------------------------------

    private static String joined(List<OcrLine> cells) {
        return String.join(" ", cells.stream().map(OcrLine::text).toList());
    }

    private static double minScore(List<OcrLine> cells) {
        return cells.stream().mapToDouble(OcrLine::score).min().orElse(0.0);
    }

    /**
     * The cells of one column read as a money value, optionally with {@code lei}/{@code ron}.
     * Every other token must hold a real digit, so a roman numeral or a word never becomes part
     * of the number (same rule as the single-value fields).
     */
    private static final Pattern UNIT = Pattern.compile("(?i)(?:buc|bucati|bucăți|pcs)\\.?");

    private static Segment money(List<OcrLine> cells) {
        List<String> kept = new ArrayList<>();
        for (String token : WHITESPACE.split(joined(cells).trim())) {
            if (!token.isEmpty() && !CURRENCY.matcher(token).matches() && !UNIT.matcher(token).matches()) {
                if (token.chars().noneMatch(c -> c >= '0' && c <= '9')) {
                    return Segment.INVALID;
                }
                kept.add(token);
            }
        }
        if (kept.isEmpty()) {
            return Segment.BLANK;
        }
        return OcrValues.money(String.join(" ", kept))
            .map(v -> new Segment(true, v, minScore(cells)))
            .orElse(Segment.INVALID);
    }

    private static Map<String, Column> headerLabels() {
        Map<String, Column> labels = new LinkedHashMap<>();
        Map<Column, List<String>> byColumn = new EnumMap<>(Column.class);
        byColumn.put(Column.NAME, NAME_LABELS);
        byColumn.put(Column.QTY, QTY_LABELS);
        byColumn.put(Column.UNIT_PRICE, UNIT_PRICE_LABELS);
        byColumn.put(Column.VALUE, VALUE_LABELS);
        byColumn.forEach((column, list) -> list.forEach(label -> {
            if (labels.put(label, column) != null) {
                throw new IllegalStateException("header label in two columns: " + label);
            }
        }));
        return Collections.unmodifiableMap(labels);
    }

    // ---- internals --------------------------------------------------------------------------

    private record Kept(ExtractedPart part, double score) {}

    /** valid=false: not a number. valid with null value: nothing there. */
    private record Segment(boolean valid, BigDecimal value, double score) {
        static final Segment INVALID = new Segment(false, null, 0.0);
        static final Segment BLANK = new Segment(true, null, 0.0);
    }

    /** Header row cells left to right; {@code columns.get(i)} is null for an unrecognised cell. */
    private record Header(List<OcrLine> cells, List<Column> columns, double score, boolean fuzzy) {

        static Optional<Header> of(List<OcrLine> row) {
            List<Column> columns = new ArrayList<>();
            Set<Column> seen = new LinkedHashSet<>();
            double score = 1.0;
            boolean fuzzy = false;
            for (OcrLine cell : row) {
                Optional<OcrText.LabelMatch> match = OcrText.matchLabel(
                    OcrText.fold(cell.text()), ALL_HEADER_LABELS);
                Column column = match.map(m -> HEADER_LABELS.get(m.label())).orElse(null);
                if (column != null && seen.add(column)) {
                    score = Math.min(score, cell.score());
                    fuzzy |= match.get().fuzzy();
                    columns.add(column);
                } else {
                    columns.add(null); // unrecognised, or a repeated column: claims cells, never read
                }
            }
            return seen.contains(Column.NAME) && seen.contains(Column.VALUE)
                ? Optional.of(new Header(row, columns, score, fuzzy))
                : Optional.empty();
        }

        boolean has(Column column) {
            return columns.contains(column);
        }

        /** Body cells grouped by the column whose header x-range each overlaps most (left to right). */
        Map<Column, List<OcrLine>> assign(List<OcrLine> row) {
            Map<Column, List<OcrLine>> out = new EnumMap<>(Column.class);
            for (OcrLine cell : row) {
                int best = -1;
                int bestOverlap = 0;
                for (int i = 0; i < cells.size(); i++) {
                    OcrBox h = cells.get(i).box();
                    int overlap = Math.min(h.xMax(), cell.box().xMax()) - Math.max(h.xMin(), cell.box().xMin());
                    if (overlap > bestOverlap) {
                        best = i;
                        bestOverlap = overlap;
                    }
                }
                if (best >= 0 && columns.get(best) != null) {
                    out.computeIfAbsent(columns.get(best), c -> new ArrayList<>()).add(cell);
                }
            }
            return out;
        }
    }
}
