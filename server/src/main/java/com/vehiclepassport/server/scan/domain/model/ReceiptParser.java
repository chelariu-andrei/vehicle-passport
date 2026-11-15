package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Deterministic OCR-text-to-invoice parser. It has no instruction semantics: it matches a fixed
 * label dictionary and fixed linear-time regexes, and a value is either a literal reading or empty.
 *
 * <p>Rules (plan P9-P11, P14): a label must start its OCR line and the rest of that line may only
 * be the value (plus {@code lei}/{@code ron} and {@code NN%}); the value is the rightmost number
 * right of the label; confidence is the score of the line that supplied the value's text, times
 * 0.7 when the label matched fuzzily. Numeric and date values whose line scores below 0.50 are
 * emptied with {@link ScanWarning#LOW_CONFIDENCE_READ}.
 */
public final class ReceiptParser {

    private static final List<String> LABOR = List.of("total i", "total manopera", "manopera");
    private static final List<String> TOTAL = List.of("total general", "total iii = i + ii", "total iii", "total");
    private static final List<String> TOTAL_I = List.of("total i");
    private static final List<String> TOTAL_II = List.of("total ii");
    private static final List<String> TOTAL_III = List.of("total iii = i + ii", "total iii");
    private static final List<String> VAT = List.of("tva");
    private static final List<String> KM = List.of("kilometraj", "kilometri", "rulaj", "km");
    private static final List<String> DATE = List.of("data emiterii", "din data", "data");
    private static final List<String> ISSUER = List.of("unitate");
    private static final List<String> ALL_LABELS = Stream
        .of(LABOR, TOTAL, TOTAL_II, VAT, KM, DATE, ISSUER)
        .flatMap(List::stream).distinct().toList();
    private static final Set<String> COMPANY_WORDS = Set.of("srl", "sa", "pfa", "sc");

    private static final int NAME_MAX = 120;
    private static final double MIN_NUMERIC_SCORE = 0.50;
    private static final double FUZZY_FACTOR = 0.7;
    private static final double INCONSISTENT_CAP = 0.4;
    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");
    private static final int MIN_YEAR = 1990;

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern CURRENCY = Pattern.compile("(?i)(?:lei|ron)\\.?");
    private static final Pattern PERCENT = Pattern.compile("\\d{1,2}(?:[.,]\\d{1,2})?%");
    private static final Pattern KM_UNIT = Pattern.compile("(?i)km\\.?");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NOT_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");

    private ReceiptParser() {}

    public static ReceiptExtraction parse(OcrDocument document) {
        return parse(document, LocalDate.now());
    }

    /** {@code today} bounds plausible years (1990 to next year); nothing else depends on it. */
    public static ReceiptExtraction parse(OcrDocument document, LocalDate today) {
        if (document == null || today == null) {
            throw new IllegalArgumentException("document and today are required");
        }
        List<List<OcrLine>> ocrRows = OcrRows.rows(document.lines());
        List<List<Line>> rows = ocrRows.stream()
            .map(row -> row.stream().map(Line::of).toList())
            .toList();
        Set<ScanWarning> warnings = new LinkedHashSet<>();

        ExtractedField<BigDecimal> labor = numeric(lastLabelled(rows, LABOR, ReceiptParser::money), warnings);
        ExtractedField<BigDecimal> total = numeric(lastLabelled(rows, TOTAL, ReceiptParser::money), warnings);
        ReceiptPartsTable.Outcome table = ReceiptPartsTable.parse(ocrRows);
        warnings.addAll(table.warnings());
        ExtractedField<List<ExtractedPart>> parts = table.parts();

        BigDecimal vat = null;
        Optional<Reading<BigDecimal>> vatReading = lastLabelled(rows, VAT, ReceiptParser::money);
        if (vatReading.isPresent()) {
            if (vatReading.get().score() < MIN_NUMERIC_SCORE) {
                warnings.add(ScanWarning.LOW_CONFIDENCE_READ);
            } else {
                vat = vatReading.get().value();
            }
        }

        if (romanTotalsInconsistent(rows)) {
            warnings.add(ScanWarning.TOTALS_INCONSISTENT);
            labor = capped(labor);
            parts = capped(parts);
            total = capped(total);
        }

        ExtractedField<Integer> km = numeric(odometer(rows), warnings);
        ExtractedField<LocalDate> date = numeric(date(rows, today), warnings);
        ExtractedField<String> serviceName = serviceName(rows);

        ScanResult result = new ScanResult(serviceName, date, km, parts, labor, total);
        return new ReceiptExtraction(result, vat, List.copyOf(warnings));
    }

    // ---- labelled numeric values ------------------------------------------------------------

    /** Labels in priority order; for each, bottom-most occurrence first (totals block sits at the bottom). */
    private static <T> Optional<Reading<T>> lastLabelled(
            List<List<Line>> rows, List<String> labels, Function<String, Segment<T>> parser) {
        for (String label : labels) {
            for (int r = rows.size() - 1; r >= 0; r--) {
                Optional<Reading<T>> reading = readRow(rows.get(r), label, parser, false);
                if (reading.isPresent()) {
                    return reading;
                }
            }
        }
        return Optional.empty();
    }

    /** Value right of a label starting one of the row's lines; with {@code eitherSide}, also left of it. */
    private static <T> Optional<Reading<T>> readRow(
            List<Line> row, String label, Function<String, Segment<T>> parser, boolean eitherSide) {
        for (int i = 0; i < row.size(); i++) {
            Line line = row.get(i);
            Optional<OcrText.LabelMatch> match = OcrText.matchLabel(line.folded().text(), List.of(label));
            if (match.isEmpty()) {
                continue;
            }
            boolean fuzzy = match.get().fuzzy();
            String rest = line.folded().originalAfter(line.text(),
                line.folded().text().length() - match.get().remainder().length());
            Segment<T> own = parser.apply(rest);
            if (!own.valid()) {
                continue; // P9: something other than the value follows the label
            }
            Reading<T> best = own.value() == null ? null : new Reading<>(own.value(), line.score(), fuzzy);
            for (int j = i + 1; j < row.size(); j++) {
                Segment<T> right = parser.apply(row.get(j).text());
                if (right.valid() && right.value() != null) {
                    best = new Reading<>(right.value(), row.get(j).score(), fuzzy); // P11: rightmost wins
                }
            }
            if (best == null && eitherSide) {
                for (int j = i - 1; j >= 0 && best == null; j--) {
                    Segment<T> left = parser.apply(row.get(j).text());
                    if (left.valid() && left.value() != null) {
                        best = new Reading<>(left.value(), row.get(j).score(), fuzzy);
                    }
                }
            }
            if (best != null) {
                return Optional.of(best);
            }
        }
        return Optional.empty();
    }

    private static Optional<Reading<Integer>> odometer(List<List<Line>> rows) {
        for (String label : KM) {
            for (List<Line> row : rows) {
                Optional<Reading<Integer>> reading = readRow(row, label, ReceiptParser::kilometres, true);
                if (reading.isPresent()) {
                    return reading;
                }
                for (Line line : row) {
                    Optional<Reading<Integer>> suffixed = valueBeforeTrailingLabel(line, label);
                    if (suffixed.isPresent()) {
                        return suffixed;
                    }
                }
            }
        }
        return Optional.empty();
    }

    /** {@code 123.456 km} in one line: the label ends the line and only the value precedes it (exact match). */
    private static Optional<Reading<Integer>> valueBeforeTrailingLabel(Line line, String label) {
        String folded = line.folded().text();
        int start = folded.length() - label.length();
        if (start <= 0 || !folded.endsWith(label) || folded.charAt(start - 1) != ' ') {
            return Optional.empty();
        }
        String before = line.text().substring(0, line.folded().origin()[start]);
        Segment<Integer> value = kilometres(before);
        return value.valid() && value.value() != null
            ? Optional.of(new Reading<>(value.value(), line.score(), false))
            : Optional.empty();
    }

    private static boolean romanTotalsInconsistent(List<List<Line>> rows) {
        Optional<BigDecimal> one = surviving(lastLabelled(rows, TOTAL_I, ReceiptParser::money));
        Optional<BigDecimal> two = surviving(lastLabelled(rows, TOTAL_II, ReceiptParser::money));
        Optional<BigDecimal> three = surviving(lastLabelled(rows, TOTAL_III, ReceiptParser::money));
        if (one.isEmpty() || two.isEmpty() || three.isEmpty()) {
            return false;
        }
        return one.get().add(two.get()).subtract(three.get()).abs().compareTo(TOLERANCE) > 0;
    }

    private static Optional<BigDecimal> surviving(Optional<Reading<BigDecimal>> reading) {
        return reading.filter(r -> r.score() >= MIN_NUMERIC_SCORE).map(Reading::value);
    }

    // ---- date -------------------------------------------------------------------------------

    private static Optional<Reading<LocalDate>> date(List<List<Line>> rows, LocalDate today) {
        for (String label : DATE) {
            for (List<Line> row : rows) {
                for (int i = 0; i < row.size(); i++) {
                    Line line = row.get(i);
                    int at = wholeWordIndex(line.folded().text(), label);
                    if (at < 0) {
                        continue;
                    }
                    Optional<LocalDate> own = plausibleDate(
                        line.folded().originalAfter(line.text(), at + label.length()), today);
                    if (own.isPresent()) {
                        return Optional.of(new Reading<>(own.get(), line.score(), false));
                    }
                    for (int j = i + 1; j < row.size(); j++) {
                        Optional<LocalDate> right = plausibleDate(row.get(j).text(), today);
                        if (right.isPresent()) {
                            return Optional.of(new Reading<>(right.get(), row.get(j).score(), false));
                        }
                    }
                }
            }
        }
        double topThird = rows.stream().flatMap(List::stream)
            .mapToInt(l -> l.ocr().box().yMax()).max().orElse(0) / 3.0; // P14
        for (List<Line> row : rows) {
            for (Line line : row) {
                if (line.ocr().box().centerY() > topThird) {
                    continue;
                }
                Optional<LocalDate> d = plausibleDate(line.text(), today);
                if (d.isPresent()) {
                    return Optional.of(new Reading<>(d.get(), line.score(), false));
                }
            }
        }
        return Optional.empty();
    }

    private static Optional<LocalDate> plausibleDate(String text, LocalDate today) {
        return OcrValues.date(text)
            .filter(d -> d.getYear() >= MIN_YEAR && d.getYear() <= today.getYear() + 1);
    }

    private static int wholeWordIndex(String text, String word) {
        int from = 0;
        while (true) {
            int at = text.indexOf(word, from);
            if (at < 0) {
                return -1;
            }
            int end = at + word.length();
            boolean startOk = at == 0 || !Character.isLetterOrDigit(text.charAt(at - 1));
            boolean endOk = end >= text.length() || !Character.isLetterOrDigit(text.charAt(end));
            if (startOk && endOk) {
                return at;
            }
            from = at + 1;
        }
    }

    // ---- service name -----------------------------------------------------------------------

    private static ExtractedField<String> serviceName(List<List<Line>> rows) {
        for (List<Line> row : rows) {
            for (int i = 0; i < row.size(); i++) {
                Line line = row.get(i);
                Optional<OcrText.LabelMatch> match = OcrText.matchLabel(line.folded().text(), ISSUER);
                if (match.isEmpty()) {
                    continue;
                }
                double factor = match.get().fuzzy() ? FUZZY_FACTOR : 1.0;
                String rest = OcrText.clean(line.folded().originalAfter(line.text(),
                    line.folded().text().length() - match.get().remainder().length()), NAME_MAX);
                if (!rest.isEmpty()) {
                    return new ExtractedField<>(rest, line.score() * factor);
                }
                for (int j = i + 1; j < row.size(); j++) {
                    String right = OcrText.clean(row.get(j).text(), NAME_MAX);
                    if (!right.isEmpty()) {
                        return new ExtractedField<>(right, row.get(j).score() * factor);
                    }
                }
            }
        }
        for (List<Line> row : rows) {
            for (Line line : row) {
                String folded = line.folded().text();
                if (OcrText.matchLabel(folded, ALL_LABELS).isPresent()) {
                    continue;
                }
                boolean company = NOT_WORD.splitAsStream(folded).anyMatch(COMPANY_WORDS::contains);
                String name = OcrText.clean(line.text(), NAME_MAX);
                if (company && !name.isEmpty()) {
                    return new ExtractedField<>(name, line.score());
                }
            }
        }
        return new ExtractedField<>(null, 0.0);
    }

    // ---- value segments ---------------------------------------------------------------------

    /** A text that is only a money value, optionally with currency and NN% tokens. */
    private static Segment<BigDecimal> money(String text) {
        List<String> kept = new ArrayList<>();
        for (String token : WHITESPACE.split(text.trim())) {
            if (!token.isEmpty() && !CURRENCY.matcher(token).matches() && !PERCENT.matcher(token).matches()) {
                if (!hasRealDigit(token)) {
                    return Segment.invalid(); // "I 350,00" must not be repaired into 1350.00
                }
                kept.add(token);
            }
        }
        if (kept.isEmpty()) {
            return Segment.blank();
        }
        return OcrValues.money(String.join(" ", kept)).map(Segment::of).orElse(Segment.invalid());
    }

    /** A text that is only a kilometre count, optionally followed by {@code km}. */
    private static Segment<Integer> kilometres(String text) {
        List<String> kept = new ArrayList<>();
        for (String token : WHITESPACE.split(text.trim())) {
            if (!token.isEmpty() && !KM_UNIT.matcher(token).matches()) {
                if (!hasRealDigit(token)) {
                    return Segment.invalid();
                }
                kept.add(token);
            }
        }
        if (kept.isEmpty()) {
            return Segment.blank();
        }
        return OcrValues.km(String.join(" ", kept)).map(Segment::of).orElse(Segment.invalid());
    }

    /** Digit repair (O/l/I) applies per whitespace token, and only to tokens holding a real digit. */
    private static boolean hasRealDigit(String token) {
        return token.chars().anyMatch(c -> c >= '0' && c <= '9');
    }

    // ---- fields -----------------------------------------------------------------------------

    private static <T> ExtractedField<T> numeric(Optional<Reading<T>> reading, Set<ScanWarning> warnings) {
        if (reading.isEmpty()) {
            return new ExtractedField<>(null, 0.0);
        }
        Reading<T> r = reading.get();
        // A read below 0.50 blanks the field; the search does not fall back to another total label,
        // because e.g. TOTAL III excludes VAT and is a different quantity from TOTAL GENERAL.
        if (r.score() < MIN_NUMERIC_SCORE) { // raw score, before the fuzzy factor
            warnings.add(ScanWarning.LOW_CONFIDENCE_READ);
            return new ExtractedField<>(null, 0.0);
        }
        return new ExtractedField<>(r.value(), r.score() * (r.fuzzy() ? FUZZY_FACTOR : 1.0));
    }

    private static <T> ExtractedField<T> capped(ExtractedField<T> field) {
        return new ExtractedField<>(field.value(), Math.min(field.confidence(), INCONSISTENT_CAP));
    }

    // ---- internals --------------------------------------------------------------------------

    private record Reading<T>(T value, double score, boolean fuzzy) {}

    /** valid=false: not value-shaped. valid with null value: nothing there. */
    private record Segment<T>(boolean valid, T value) {
        static <T> Segment<T> of(T value) {
            return new Segment<>(true, value);
        }

        static <T> Segment<T> blank() {
            return new Segment<>(true, null);
        }

        static <T> Segment<T> invalid() {
            return new Segment<>(false, null);
        }
    }

    private record Line(OcrLine ocr, Folded folded) {
        static Line of(OcrLine ocr) {
            return new Line(ocr, Folded.of(ocr.text()));
        }

        String text() {
            return ocr.text();
        }

        double score() {
            return ocr.score();
        }
    }

    /**
     * The same folding as {@link OcrText#fold} (applied per code point, control and format
     * characters dropped), plus {@code origin[k]}: the index in the original text of the character
     * that produced folded character {@code k}. Values are read from the original text through it.
     */
    private record Folded(String text, int[] origin) {

        static Folded of(String original) {
            StringBuilder out = new StringBuilder();
            List<Integer> origin = new ArrayList<>();
            boolean pendingSpace = false;
            int i = 0;
            while (i < original.length()) {
                int cp = original.codePointAt(i);
                for (char c : foldCodePoint(cp).toCharArray()) {
                    if (isSpace(c)) {
                        pendingSpace = true;
                        continue;
                    }
                    if (Character.isISOControl(c) || Character.getType(c) == Character.FORMAT) {
                        continue;
                    }
                    if (pendingSpace && !out.isEmpty()) {
                        out.append(' ');
                        origin.add(i);
                    }
                    pendingSpace = false;
                    out.append(c);
                    origin.add(i);
                }
                i += Character.charCount(cp);
            }
            origin.add(original.length());
            return new Folded(out.toString(), origin.stream().mapToInt(Integer::intValue).toArray());
        }

        /** The original text from the character that produced folded index {@code foldedIndex}. */
        String originalAfter(String original, int foldedIndex) {
            return original.substring(origin[Math.max(0, Math.min(foldedIndex, origin.length - 1))]);
        }

        private static String foldCodePoint(int cp) {
            String nfkc = Normalizer.normalize(new String(Character.toChars(cp)), Normalizer.Form.NFKC);
            return MARKS.matcher(Normalizer.normalize(nfkc, Normalizer.Form.NFD)).replaceAll("")
                .toLowerCase(Locale.ROOT);
        }

        private static boolean isSpace(char c) {
            return c == ' ' || c == '\t' || c == '\n' || c == '\u000B' || c == '\f' || c == '\r';
        }
    }
}
