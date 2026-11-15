package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.OcrBox;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import com.vehiclepassport.server.scan.domain.model.OcrRows;
import com.vehiclepassport.server.scan.domain.model.ReceiptPartsTable;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReceiptPartsTableTest {

    static OcrLine l(String text, double score, int x, int y) {
        return new OcrLine(text, score, new OcrBox(x, y, x + 10 * text.length(), y + 20));
    }

    /** The printed-deviz header row (y = 400). */
    static List<OcrLine> header() {
        return List.of(l("Reper", .98, 40, 400), l("Denumire material", .98, 200, 400),
            l("Nr. bon", .98, 700, 400), l("Pret unitar", .98, 900, 400), l("Valoare", .98, 1100, 400));
    }

    /** A body row at the header's x positions. */
    static List<OcrLine> row(int y, String name, String unit, String value) {
        return List.of(l(name, .98, 200, y), l(unit, .98, 900, y), l(value, .98, 1100, y));
    }

    /** {@code n} body rows, flattened; the rows are rebuilt by geometry. */
    static List<OcrLine> rows(int n) {
        List<OcrLine> lines = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            lines.addAll(row(450 + 50 * i, "Piesa " + i, "1,00", "1,00"));
        }
        return lines;
    }

    @SafeVarargs
    static ReceiptPartsTable.Outcome parse(List<OcrLine>... rows) {
        List<OcrLine> all = new ArrayList<>();
        for (List<OcrLine> row : rows) {
            all.addAll(row);
        }
        return ReceiptPartsTable.parse(OcrRows.rows(all));
    }

    /** Header with {@code Cant} at x = 600; a null quantity leaves that cell out. */
    static ReceiptPartsTable.Outcome parseWithQty(String qty, String unit, String value) {
        List<OcrLine> header = new ArrayList<>(header());
        header.add(l("Cant", .98, 600, 400));
        List<OcrLine> body = new ArrayList<>(row(450, "Filtru ulei", unit, value));
        if (qty != null) {
            body.add(l(qty, .98, 600, 450));
        }
        return parse(header, body);
    }

    static ReceiptPartsTable.Outcome parseWithQty(String qty) {
        return parseWithQty(qty, "45,00", "45,00");
    }

    @Test void price_is_the_line_value_and_qty_is_empty_without_a_column() {
        var o = parse(header(), row(450, "Ulei motor", "200,00", "1.000,00"));
        assertEquals(List.of(new ExtractedPart("Ulei motor", null, new BigDecimal("1000.00"))), o.parts().value());
        assertEquals(List.of(), o.warnings());
    }
    @Test void blank_cell_in_a_quantity_column_defaults_to_one() { /* header with "Cant" at x=600; no cell there */
        assertEquals(0, BigDecimal.ONE.compareTo(parseWithQty(null).parts().value().get(0).qty()));
    }
    @Test void unreadable_quantity_skips_the_row() {
        var o = parseWithQty("doi");
        assertEquals(List.of(), o.parts().value());
        assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
    }
    @Test void qty_times_unit_price_mismatch_warns() {
        assertEquals(List.of(ScanWarning.PART_LINE_MISMATCH), parseWithQty("2", "45,00", "45,00").warnings());
    }
    @Test void no_header_leaves_parts_empty() {
        var o = parse(row(450, "Ulei", "1,00", "1,00"));
        assertNull(o.parts().value()); assertEquals(0.0, o.parts().confidence());
    }
    @Test void header_without_rows_is_an_empty_list() {
        var o = parse(header());
        assertEquals(List.of(), o.parts().value()); assertEquals(.98, o.parts().confidence(), 1e-9);
    }
    @Test void low_score_value_skips_the_row() {
        var o = parse(header(), List.of(l("Ulei", .9, 200, 450), l("1.000,00", .3, 1100, 450)));
        assertEquals(List.of(), o.parts().value());
        assertTrue(o.warnings().contains(ScanWarning.LOW_CONFIDENCE_READ));
    }
    @Test void low_score_name_is_kept_and_lowers_confidence() {
        var o = parse(header(), List.of(l("Ulei", .2, 200, 450), l("1.000,00", .9, 1100, 450)));
        assertEquals("Ulei", o.parts().value().get(0).name());
        assertEquals(.2, o.parts().confidence(), 1e-9);
    }
    @Test void table_stops_at_the_totals_block() {
        assertEquals(1, parse(header(), row(450, "Ulei", "1,00", "1,00"), List.of(l("TOTAL II", .9, 40, 500), l("1,00", .9, 1100, 500)))
            .parts().value().size());
    }
    @Test void more_than_100_rows_keeps_100_and_warns() {
        var o = parse(header(), rows(101));
        assertEquals(100, o.parts().value().size());
        assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
    }

    // ---- beyond the brief: edges of the same rules ----

    @Test void matching_qty_times_unit_price_does_not_warn() {
        var o = parseWithQty("2", "22,50", "45,00");
        assertEquals(0, new BigDecimal("2").compareTo(o.parts().value().get(0).qty()));
        assertEquals(List.of(), o.warnings());
    }
    @Test void a_unit_word_in_the_quantity_cell_is_ignored() {
        var o = parseWithQty("2 buc", "22,50", "45,00");
        assertEquals(0, new BigDecimal("2").compareTo(o.parts().value().get(0).qty()));
        assertEquals(List.of(), o.warnings());
    }
    @Test void a_roman_numeral_or_word_never_becomes_a_value() {
        var o = parse(header(), List.of(l("Ulei", .9, 200, 450), l("I 350,00", .9, 1100, 450)));
        assertEquals(List.of(), o.parts().value());
        assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
    }
    @Test void fuzzy_header_multiplies_confidence() {
        var header = List.of(l("Denumire material", .98, 200, 400), l("Valoere", 1.0, 1100, 400));
        var o = parse(header, List.of(l("Ulei", 1.0, 200, 450), l("1,00", 1.0, 1100, 450)));
        assertEquals(.98 * .7, o.parts().confidence(), 1e-9);
    }
    @Test void operations_table_without_denumire_is_not_a_header() {
        var ops = List.of(l("Cod", .98, 40, 400), l("Obiectul", .98, 200, 400), l("Tarif", .98, 1100, 400));
        assertNull(parse(ops, List.of(l("Schimb ulei", .98, 200, 450), l("100,00", .98, 1100, 450))).parts().value());
    }
    @Test void cells_under_unrecognised_columns_are_ignored() {
        var o = parse(header(), List.of(l("1", .98, 40, 450), l("Filtru", .98, 200, 450),
            l("77", .98, 700, 450), l("45,00", .98, 1100, 450)));
        assertEquals(List.of(new ExtractedPart("Filtru", null, new BigDecimal("45.00"))), o.parts().value());
    }
    @Test void row_without_a_value_is_skipped_with_warning() {
        var o = parse(header(), List.of(l("Filtru", .98, 200, 450)));
        assertEquals(List.of(), o.parts().value());
        assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
    }
    @Test void long_part_name_is_capped_at_120() {
        var o = parse(header(), List.of(l("A".repeat(130), .98, 200, 450), l("1,00", .98, 1100, 450)));
        assertEquals(120, o.parts().value().get(0).name().length());
    }
}
