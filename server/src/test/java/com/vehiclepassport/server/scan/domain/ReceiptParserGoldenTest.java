package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.OcrBox;
import com.vehiclepassport.server.scan.domain.model.OcrDocument;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import com.vehiclepassport.server.scan.domain.model.ReceiptParser;
import com.vehiclepassport.server.scan.domain.model.ReceiptValidator;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Whole-document fixtures in the {@code /ocr} response shape, read with a plain ObjectMapper. */
class ReceiptParserGoldenTest {

    static OcrDocument load(String resource) {
        try (InputStream in = ReceiptParserGoldenTest.class.getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(in, resource);
            JsonNode root = new ObjectMapper().readTree(in);
            List<OcrLine> lines = new ArrayList<>();
            for (JsonNode line : root.get("lines")) {
                JsonNode box = line.get("box");
                lines.add(new OcrLine(line.get("text").asText(), line.get("score").asDouble(),
                    new OcrBox(box.get(0).asInt(), box.get(1).asInt(), box.get(2).asInt(), box.get(3).asInt())));
            }
            return new OcrDocument(root.get("width").asInt(), root.get("height").asInt(), lines);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test void printed_deviz() {
        var x = ReceiptParser.parse(load("ocr/printed-deviz.json"));
        var r = x.result();
        assertEquals("AUTO EXPERT SRL", r.serviceName().value());
        assertEquals(LocalDate.of(2026, 3, 15), r.date().value());
        assertNull(r.odometerKm().value());
        assertEquals(new BigDecimal("350.00"), r.labor().value());
        assertEquals(List.of(new ExtractedPart("Filtru ulei", null, new BigDecimal("45.00")),
                             new ExtractedPart("Ulei motor 5W30", null, new BigDecimal("1000.00"))), r.parts().value());
        assertEquals(new BigDecimal("1687.95"), r.total().value());
        assertEquals(new BigDecimal("292.95"), x.vat());
        assertEquals(List.of(), x.warnings());
        assertEquals(List.of(), ReceiptValidator.validate(r, x.vat(), LocalDate.of(2026, 4, 1), true));
    }
}
