package com.vehiclepassport.server.passport.infrastructure;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.application.port.out.PassportDocument;
import com.vehiclepassport.server.passport.domain.model.SnapshotCustomField;
import com.vehiclepassport.server.passport.domain.model.SnapshotDetails;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotPart;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import com.vehiclepassport.server.passport.infrastructure.client.PdfRendererAdapter;
import com.vehiclepassport.server.passport.infrastructure.client.QrCodeAdapter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfRendererAdapterTest {

    private static final String HASH = "a3f1c9d2e4b5a6978877665544332211a3f1c9d2e4b5a6978877665544332211";
    private static final String URL = "https://passport.example.com/p/VeryLongTokenValue_abcdefghijklmnopqrstuvwxyz0123456789-ABCDEFGHIJ";

    private final PdfRendererAdapter adapter = new PdfRendererAdapter();

    private static SnapshotEvent event(String notes, int i) {
        return new SnapshotEvent(UUID.randomUUID(), "SERVICE", LocalDate.of(2024, 1, 1).plusDays(i), 1000 + i,
                new BigDecimal("100.00"), "RON", notes, "Service SRL",
                List.of(new SnapshotPart("Filtru ulei", BigDecimal.ONE, new BigDecimal("50.00"))),
                new BigDecimal("20.00"), "NONE", false);
    }

    private static PassportDocument doc(List<SnapshotEvent> events) {
        return new PassportDocument(new SnapshotVehicle("WVWZZZ1JZXW000001", "Dacia", "Logan", "1.0 TCe", 2020, "PETROL"),
                events, HASH, URL, new QrCodeAdapter().png(URL));
    }

    private record Rendered(String text, int pages) {}

    private Rendered render(PassportDocument d) throws Exception {
        byte[] pdf = adapter.render(d);
        try (PDDocument p = Loader.loadPDF(pdf)) {
            return new Rendered(new PDFTextStripper().getText(p), p.getNumberOfPages());
        }
    }

    private static String compact(String s) {
        return s.replaceAll("\\s+", "");
    }

    @Test
    void contains_vin_hash_and_public_url() throws Exception {
        String text = compact(render(doc(List.of(event("ok", 0)))).text());
        assertTrue(text.contains("WVWZZZ1JZXW000001"));
        assertTrue(text.contains(HASH));
        assertTrue(text.contains(URL));
    }

    @Test
    void renders_romanian_diacritics() throws Exception {
        String text = render(doc(List.of(event("Înlocuit ștergătoare, țeavă", 0)))).text();
        assertTrue(text.contains("Înlocuit ștergătoare, țeavă"), text);
    }

    @Test
    void two_hundred_events_span_multiple_pages_and_all_appear() throws Exception {
        List<SnapshotEvent> events = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            events.add(event("note-" + i + "-end", i));
        }
        Rendered r = render(doc(events));
        assertTrue(r.pages() > 1);
        assertTrue(r.text().contains("note-0-end"));
        assertTrue(r.text().contains("note-199-end"));
    }

    @Test
    void very_long_note_without_spaces_does_not_crash() {
        assertDoesNotThrow(() -> render(doc(List.of(event("x".repeat(5000), 0)))));
    }

    @Test
    void emoji_in_notes_does_not_crash() throws Exception {
        Rendered r = render(doc(List.of(event("Gata \uD83D\uDE97\uD83D\uDD27 ok", 0))));
        assertTrue(r.text().contains("Gata"));
    }

    @Test
    void no_events_renders() {
        assertDoesNotThrow(() -> render(doc(List.of())));
    }

    @Test
    void markup_in_a_service_name_is_rendered_as_literal_text() throws Exception {
        String hostile = "<b>Auto</b> ${x} (a) Tj";
        SnapshotEvent e = new SnapshotEvent(UUID.randomUUID(), "SERVICE", LocalDate.of(2024, 1, 1), 1000,
                new BigDecimal("100.00"), "RON", "ok", hostile, List.of(), null, "NONE", false);
        assertTrue(render(doc(List.of(e))).text().contains(hostile));
    }

    @Test
    void extended_fields_are_rendered_and_missing_km_is_omitted() throws Exception {
        SnapshotEvent insurance = new SnapshotEvent(UUID.randomUUID(), "INSURANCE", LocalDate.of(2025, 5, 1), null,
                new BigDecimal("2400.00"), "RON", null, null, null, null, "USER_CONFIRMED", false, null,
                LocalDate.of(2025, 5, 1), LocalDate.of(2026, 4, 30),
                new SnapshotDetails("INSURANCE", "CASCO", "Allianz", null, null, null, null, null), null, null);
        SnapshotEvent other = new SnapshotEvent(UUID.randomUUID(), "OTHER", LocalDate.of(2025, 6, 1), 95000, null,
                null, null, null, null, null, "USER_CONFIRMED", false, "Ceramic coating", null, null, null,
                List.of("BODY"), List.of(new SnapshotCustomField("Layers", "3")));
        SnapshotEvent itp = new SnapshotEvent(UUID.randomUUID(), "ITP", LocalDate.of(2025, 2, 1), 90000, null, null,
                null, null, null, null, "DOCUMENTED", false, null, null, LocalDate.of(2027, 2, 1),
                new SnapshotDetails("ITP", null, null, null, null, "ITP Nord", "PASSED", null), null, null);
        String text = render(doc(List.of(insurance, other, itp))).text().replace((char) 160, (char) 32);
        assertTrue(text.contains("INSURANCE · CASCO · Allianz 2400.00 RON"), text);
        assertFalse(text.contains("null km"), text);
        assertTrue(text.contains("valid 2025-05-01–2026-04-30"), text);
        assertTrue(text.contains("Ceramic coating 95000 km"), text);
        assertTrue(text.contains("Layers: 3"), text);
        assertTrue(text.contains("Components: BODY"), text);
        assertTrue(text.contains("ITP · ITP Nord · PASSED"), text);
    }
}
