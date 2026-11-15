package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.scan.domain.model.OcrBox;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import com.vehiclepassport.server.scan.domain.model.OcrRows;
import java.util.List;
import org.junit.jupiter.api.Test;

class OcrRowsTest {

    static OcrLine l(String text, double score, int x, int y) {
        return new OcrLine(text, score, new OcrBox(x, y, x + 10 * text.length(), y + 20));
    }

    @Test
    void tilted_rows_stay_separate_and_input_order_is_irrelevant() {
        var a1 = l("A1", .9, 0, 100); var a2 = l("A2", .9, 500, 108);
        var b1 = l("B1", .9, 0, 130); var b2 = l("B2", .9, 500, 138);
        assertEquals(List.of(List.of(a1, a2), List.of(b1, b2)), OcrRows.rows(List.of(b2, a1, b1, a2)));
    }
}
