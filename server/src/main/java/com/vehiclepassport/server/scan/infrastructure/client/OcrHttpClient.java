package com.vehiclepassport.server.scan.infrastructure.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.OcrBox;
import com.vehiclepassport.server.scan.domain.model.OcrDocument;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/** Posts an image to the OCR service. Every failure is an {@link ExtractionFailedException} with a constant message. */
public class OcrHttpClient {

    // Private mapper: the app-wide one rejects unknown properties, the OCR response may grow fields.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final URI endpoint;
    private final Duration timeout;
    private final HttpClient http;

    public OcrHttpClient(URI baseUrl, Duration timeout) {
        String base = baseUrl.toString();
        this.endpoint = URI.create((base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/ocr");
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public OcrDocument recognize(byte[] content, String contentType) {
        String boundary = "----receipt" + UUID.randomUUID().toString().replace("-", "");
        String filename = "image/png".equalsIgnoreCase(contentType) ? "receipt.png" : "receipt.jpg";
        HttpRequest request = HttpRequest.newBuilder(endpoint)
            .timeout(timeout)
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(multipart(boundary, filename, contentType, content)))
            .build();
        HttpResponse<byte[]> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExtractionFailedException("OCR request interrupted");
        } catch (IOException | RuntimeException e) {
            throw new ExtractionFailedException("OCR service unreachable");
        }
        if (response.statusCode() != 200) {
            throw new ExtractionFailedException("OCR service returned an error");
        }
        try {
            Body body = MAPPER.readValue(response.body(), Body.class);
            if (body == null || body.lines() == null) {
                throw new IllegalArgumentException("no lines");
            }
            List<OcrLine> lines = body.lines().stream().map(OcrHttpClient::toLine).toList();
            return new OcrDocument(body.width(), body.height(), lines);
        } catch (IOException | RuntimeException e) {
            throw new ExtractionFailedException("OCR response malformed");
        }
    }

    private static OcrLine toLine(Line line) {
        if (line == null || line.box() == null || line.box().size() != 4 || line.box().contains(null)) {
            throw new IllegalArgumentException("bad line");
        }
        List<Number> b = line.box();
        double score = Double.isNaN(line.score()) ? 0.0 : Math.max(0.0, Math.min(1.0, line.score()));
        return new OcrLine(line.text(), score,
            new OcrBox(b.get(0).intValue(), b.get(1).intValue(), b.get(2).intValue(), b.get(3).intValue()));
    }

    private static byte[] multipart(String boundary, String filename, String contentType, byte[] content) {
        String type = contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType;
        var out = new ByteArrayOutputStream(content.length + 256);
        String head = "--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
            + "Content-Type: " + type + "\r\n\r\n";
        out.writeBytes(head.getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes(content);
        out.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.ISO_8859_1));
        return out.toByteArray();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Body(int width, int height, List<Line> lines) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Line(String text, double score, List<Number> box) {}
}
