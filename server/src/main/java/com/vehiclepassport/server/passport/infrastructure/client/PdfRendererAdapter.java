package com.vehiclepassport.server.passport.infrastructure.client;

import com.vehiclepassport.server.passport.application.port.out.PassportDocument;
import com.vehiclepassport.server.passport.application.port.out.PdfRendererPort;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotPart;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

@ApplicationScoped
public class PdfRendererAdapter implements PdfRendererPort {

    private static final String FONT_RESOURCE = "/fonts/DejaVuSans.ttf";
    private static final float MARGIN = 50f;
    private static final float BODY = 9f;
    private static final float TITLE = 18f;
    private static final float QR_SIZE = 110f;

    @Override
    public byte[] render(PassportDocument document) {
        try (PDDocument pdf = new PDDocument()) {
            PDType0Font font;
            try (InputStream in = PdfRendererAdapter.class.getResourceAsStream(FONT_RESOURCE)) {
                if (in == null) {
                    throw new IllegalStateException("Missing font resource " + FONT_RESOURCE);
                }
                font = PDType0Font.load(pdf, in);
            }
            new Writer(pdf, font).write(document);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdf.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("PDF rendering failed", e);
        }
    }

    private static final class Writer {
        private final PDDocument pdf;
        private final PDType0Font font;
        private final float width = PDRectangle.A4.getWidth();
        private final float height = PDRectangle.A4.getHeight();
        private PDPageContentStream stream;
        private float y;

        Writer(PDDocument pdf, PDType0Font font) {
            this.pdf = pdf;
            this.font = font;
        }

        void write(PassportDocument d) throws IOException {
            newPage();
            PDImageXObject qr = PDImageXObject.createFromByteArray(pdf, d.qrPng(), "qr");
            float top = y;
            float textWidth = width - 2 * MARGIN - QR_SIZE - 15;
            stream.drawImage(qr, width - MARGIN - QR_SIZE, top - QR_SIZE, QR_SIZE, QR_SIZE);
            line("Vehicle Passport", TITLE, 0, textWidth);
            y -= 4;
            var v = d.vehicle();
            line("VIN: " + v.vin(), BODY, 0, textWidth);
            line(v.make() + " " + v.model() + ", " + v.year(), BODY, 0, textWidth);
            line("Engine: " + v.engine() + "  Fuel: " + v.fuel(), BODY, 0, textWidth);
            line("Hash: " + d.hash(), BODY, 0, textWidth);
            line("URL: " + d.publicUrl(), BODY, 0, textWidth);
            y = Math.min(y, top - QR_SIZE) - 14;
            line("Service history (" + d.events().size() + " events)", 12f, 0, width - 2 * MARGIN);
            y -= 4;
            for (SnapshotEvent e : d.events()) {
                event(e);
            }
            stream.close();
        }

        private void event(SnapshotEvent e) throws IOException {
            float full = width - 2 * MARGIN;
            String head = e.date() + "  " + e.type() + "  " + e.odometerKm() + " km"
                    + (e.costAmount() != null ? "  " + e.costAmount().toPlainString() + " " + nz(e.currency()) : "");
            line(head, BODY, 0, full);
            if (e.serviceName() != null && !e.serviceName().isBlank()) {
                line("Service: " + e.serviceName(), BODY, 12, full);
            }
            if (e.notes() != null && !e.notes().isBlank()) {
                line(e.notes(), BODY, 12, full);
            }
            if (e.parts() != null) {
                for (SnapshotPart p : e.parts()) {
                    line("- " + p.name() + " x" + p.qty().toPlainString() + " @ " + p.price().toPlainString(),
                            BODY, 12, full);
                }
            }
            if (e.labor() != null) {
                line("Labor: " + e.labor().toPlainString(), BODY, 12, full);
            }
            y -= 5;
        }

        private static String nz(String s) {
            return s == null ? "" : s;
        }

        private void line(String raw, float size, float indent, float maxWidth) throws IOException {
            for (String l : wrap(sanitize(raw), size, maxWidth - indent)) {
                float leading = size * 1.35f;
                if (y - leading < MARGIN) {
                    stream.close();
                    newPage();
                }
                y -= leading;
                stream.beginText();
                stream.setFont(font, size);
                stream.newLineAtOffset(MARGIN + indent, y);
                stream.showText(l);
                stream.endText();
            }
        }

        private void newPage() throws IOException {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            stream = new PDPageContentStream(pdf, page);
            y = height - MARGIN;
        }

        /** Replaces control characters with spaces and code points the font cannot encode with a question mark. */
        private String sanitize(String s) {
            StringBuilder sb = new StringBuilder();
            s.codePoints().forEach(cp -> {
                if (Character.isISOControl(cp)) {
                    sb.append(' ');
                    return;
                }
                String c = new String(Character.toChars(cp));
                try {
                    font.encode(c);
                    sb.append(c);
                } catch (IllegalArgumentException | IOException ex) {
                    sb.append('?');
                }
            });
            return sb.toString();
        }

        private float widthOf(String s, float size) throws IOException {
            return font.getStringWidth(s) / 1000f * size;
        }

        private List<String> wrap(String text, float size, float max) throws IOException {
            List<String> lines = new ArrayList<>();
            StringBuilder cur = new StringBuilder();
            for (String word : text.split(" ")) {
                if (word.isEmpty()) {
                    continue;
                }
                String candidate = cur.isEmpty() ? word : cur + " " + word;
                if (widthOf(candidate, size) <= max) {
                    cur = new StringBuilder(candidate);
                    continue;
                }
                if (!cur.isEmpty()) {
                    lines.add(cur.toString());
                    cur = new StringBuilder();
                }
                // The word alone may still be too wide: break it by code point.
                StringBuilder piece = new StringBuilder();
                for (int cp : word.codePoints().toArray()) {
                    String next = piece + new String(Character.toChars(cp));
                    if (!piece.isEmpty() && widthOf(next, size) > max) {
                        lines.add(piece.toString());
                        piece = new StringBuilder();
                    }
                    piece.appendCodePoint(cp);
                }
                cur = piece;
            }
            if (!cur.isEmpty()) {
                lines.add(cur.toString());
            }
            if (lines.isEmpty()) {
                lines.add("");
            }
            return lines;
        }
    }
}
