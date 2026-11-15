package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure parsers for Romanian-formatted values read from OCR text. Empty means no clean reading. */
public final class OcrValues {

    private static final Pattern REPAIRABLE = Pattern.compile("[0-9OlI.,\\s]+");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");
    private static final Pattern GROUPED_DOT = Pattern.compile("\\d{1,3}(\\.\\d{3})+(,\\d{1,2})?");
    private static final Pattern GROUPED_SPACE = Pattern.compile("\\d{1,3}( \\d{3})+(,\\d{1,2})?");
    private static final Pattern COMMA_DECIMAL = Pattern.compile("\\d+,\\d{1,2}");
    private static final Pattern DOT_DECIMAL = Pattern.compile("\\d+\\.\\d{1,2}");
    private static final Pattern PLAIN = Pattern.compile("\\d+");
    private static final Pattern GROUPED_INT = Pattern.compile("\\d{1,3}([. ]\\d{3})+");
    private static final Pattern DATE = Pattern.compile("(?<!\\d)(\\d{2})([./-])(\\d{2})\\2(\\d{4})(?!\\d)");

    private OcrValues() {}

    public static Optional<BigDecimal> money(String text) {
        Optional<String> token = numericToken(stripCurrency(text));
        if (token.isEmpty()) {
            return Optional.empty();
        }
        String t = token.get();
        if (GROUPED_DOT.matcher(t).matches()) {
            return Optional.of(new BigDecimal(t.replace(".", "").replace(',', '.')));
        }
        if (GROUPED_SPACE.matcher(t).matches()) {
            return Optional.of(new BigDecimal(t.replace(" ", "").replace(',', '.')));
        }
        if (COMMA_DECIMAL.matcher(t).matches()) {
            return Optional.of(new BigDecimal(t.replace(',', '.')));
        }
        if (DOT_DECIMAL.matcher(t).matches() || PLAIN.matcher(t).matches()) {
            return Optional.of(new BigDecimal(t));
        }
        return Optional.empty();
    }

    public static Optional<Integer> km(String text) {
        Optional<String> token = numericToken(text);
        if (token.isEmpty()) {
            return Optional.empty();
        }
        String t = token.get();
        if (!PLAIN.matcher(t).matches() && !GROUPED_INT.matcher(t).matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Integer.parseInt(t.replace(".", "").replace(" ", "")));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** First valid dd.MM.yyyy date in the text; the separator (. / -) must repeat. */
    public static Optional<LocalDate> date(String text) {
        if (text == null) {
            return Optional.empty();
        }
        Matcher m = DATE.matcher(text);
        while (m.find()) {
            try {
                return Optional.of(LocalDate.of(
                    Integer.parseInt(m.group(4)), Integer.parseInt(m.group(3)), Integer.parseInt(m.group(1))));
            } catch (DateTimeException e) {
                // not a real calendar date, keep looking
            }
        }
        return Optional.empty();
    }

    private static String stripCurrency(String text) {
        if (text == null) {
            return "";
        }
        String t = text.trim();
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.endsWith("lei") || lower.endsWith("ron")) {
            t = t.substring(0, t.length() - 3).trim();
        }
        return t;
    }

    /** Applies the only allowed digit repair (O to 0, l and I to 1) to a numeric-only token with a real digit. */
    private static Optional<String> numericToken(String text) {
        if (text == null) {
            return Optional.empty();
        }
        String t = text.trim();
        if (t.isEmpty() || !REPAIRABLE.matcher(t).matches() || !HAS_DIGIT.matcher(t).find()) {
            return Optional.empty();
        }
        return Optional.of(t.replace('O', '0').replace('l', '1').replace('I', '1'));
    }
}
