package com.vehiclepassport.server.scan;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.scan.domain.model.OcrDocument;
import com.vehiclepassport.server.scan.infrastructure.client.OcrHttpClient;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.time.Duration;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Talks to a real OCR container. Runs only when OCR_IT_BASE_URL is set, e.g. http://127.0.0.1:8090. */
@EnabledIfEnvironmentVariable(named = "OCR_IT_BASE_URL", matches = ".+")
class PaddleOcrLiveIT {

    @Test
    void the_real_service_reads_a_printed_total() throws Exception {
        BufferedImage image = new BufferedImage(1000, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 1000, 300);
        g.setColor(Color.BLACK);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 72));
        g.drawString("TOTAL GENERAL 1.234,56", 40, 170);
        g.dispose();
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(image, "png", png);

        OcrHttpClient client = new OcrHttpClient(URI.create(System.getenv("OCR_IT_BASE_URL")), Duration.ofMinutes(3));
        OcrDocument document = client.recognize(png.toByteArray(), "image/png");

        assertTrue(document.lines().stream().anyMatch(l -> l.text().contains("TOTAL")), document.lines().toString());
    }
}
