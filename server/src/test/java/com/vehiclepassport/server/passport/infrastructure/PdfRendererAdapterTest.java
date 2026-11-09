package com.vehiclepassport.server.passport.infrastructure;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.application.port.out.PassportDocument;
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
}
