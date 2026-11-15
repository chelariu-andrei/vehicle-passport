package com.vehiclepassport.server.scan.domain.model;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/** Pure helpers that normalise OCR text and match it against a fixed label dictionary. */
public final class OcrText {

    /** A label found at the start of a folded text. {@code remainder} is what follows the label. */
    public record LabelMatch(String label, String remainder, boolean fuzzy) {}

    private static final int MIN_FUZZY_LABEL_LENGTH = 6;
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern CONTROLS = Pattern.compile("[\\p{Cc}\\p{Cf}]");

    private OcrText() {}

    /** NFKC, combining marks stripped (covers the Romanian diacritics and umlauts), lowercase, whitespace collapsed. */
    public static String fold(String text) {
        if (text == null) {
            return "";
        }
        String nfkc = Normalizer.normalize(text, Normalizer.Form.NFKC);
        String stripped = MARKS.matcher(Normalizer.normalize(nfkc, Normalizer.Form.NFD)).replaceAll("");
        return WHITESPACE.matcher(stripped.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
    }

    /**
     * Matches a label at the start of an already folded text. Longest labels first, exact before
     * fuzzy (edit distance 1), whole words only. Fuzzy matching is skipped for labels shorter than
     * six characters and for labels ending in a roman numeral.
     */
    public static Optional<LabelMatch> matchLabel(String foldedText, List<String> labels) {
        if (foldedText == null || labels == null || labels.isEmpty()) {
            return Optional.empty();
        }
        List<String> byLength = labels.stream()
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();
        for (String label : byLength) {
            if (!label.isEmpty() && foldedText.startsWith(label) && boundaryAt(foldedText, label.length())) {
                return Optional.of(new LabelMatch(label, remainder(foldedText, label.length()), false));
            }
        }
        for (String label : byLength) {
            if (!fuzzyAllowed(label)) {
                continue;
            }
            int[] lengths = {label.length(), label.length() - 1, label.length() + 1};
            for (int length : lengths) {
                if (length <= 0 || length > foldedText.length() || !boundaryAt(foldedText, length)) {
                    continue;
                }
                if (editDistanceIsOne(foldedText.substring(0, length), label)) {
                    return Optional.of(new LabelMatch(label, remainder(foldedText, length), true));
                }
            }
        }
        return Optional.empty();
    }

    /** Strips control and format characters, trims, and truncates without splitting a surrogate pair. */
    public static String clean(String text, int maxCodePoints) {
        if (text == null) {
            return "";
        }
        String stripped = CONTROLS.matcher(text).replaceAll("").trim();
        if (stripped.codePointCount(0, stripped.length()) <= maxCodePoints) {
            return stripped;
        }
        return stripped.substring(0, stripped.offsetByCodePoints(0, Math.max(0, maxCodePoints))).trim();
    }

    private static boolean fuzzyAllowed(String label) {
        if (label.length() < MIN_FUZZY_LABEL_LENGTH) {
            return false;
        }
        String last = label.substring(label.lastIndexOf(' ') + 1);
        return last.isEmpty() || !last.chars().allMatch(c -> c == 'i' || c == 'v' || c == 'x');
    }

    private static boolean boundaryAt(String text, int index) {
        return index >= text.length() || !Character.isLetterOrDigit(text.codePointAt(index));
    }

    private static String remainder(String text, int from) {
        int i = from;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (c == ':' || c == '.' || c == ' ') {
                i++;
            } else {
                break;
            }
        }
        return text.substring(i);
    }

    /** True when the two strings differ by exactly one insertion, deletion or substitution. */
    private static boolean editDistanceIsOne(String a, String b) {
        int la = a.length();
        int lb = b.length();
        if (Math.abs(la - lb) > 1 || a.equals(b)) {
            return false;
        }
        int i = 0;
        while (i < la && i < lb && a.charAt(i) == b.charAt(i)) {
            i++;
        }
        if (la == lb) {
            return a.substring(i + 1).equals(b.substring(i + 1));
        }
        return la > lb ? a.substring(i + 1).equals(b.substring(i)) : b.substring(i + 1).equals(a.substring(i));
    }
}
