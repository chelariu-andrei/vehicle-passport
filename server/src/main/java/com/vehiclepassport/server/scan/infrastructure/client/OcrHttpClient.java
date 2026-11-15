package com.vehiclepassport.server.scan.infrastructure.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.domain.model.OcrBox;
import com.vehiclepassport.server.scan.domain.model.OcrDocument;
import com.vehiclepassport.server.scan.domain.model.OcrLine;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/** Posts an image to the OCR service. Every runtime failure is an {@link ExtractionFailedException} with a constant message. */
public class OcrHttpClient {

    static final int MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
    static final int MAX_LINES = 5000;

    // Private mapper: the app-wide one rejects unknown properties, the OCR response may grow fields.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final URI endpoint;
    private final Duration timeout;
    private final HttpClient http;

    /** @throws IllegalArgumentException (constant message) when the configuration is unusable, so the app fails at startup */
    public OcrHttpClient(URI baseUrl, Duration timeout) {
        if (baseUrl == null || baseUrl.getHost() == null
                || !("http".equalsIgnoreCase(baseUrl.getScheme()) || "https".equalsIgnoreCase(baseUrl.getScheme()))) {
            throw new IllegalArgumentException("scan.ocr.base-url must be an http(s) URL with a host");
        }
        if (timeout == null || timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("scan.ocr.timeout must be positive");
        }
        String base = baseUrl.toString();
        try {
            this.endpoint = URI.create((base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/ocr");
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("scan.ocr.base-url must be an http(s) URL with a host");
        }
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public OcrDocument recognize(byte[] content, String contentType) {
        byte[] body;
        try {
            String boundary = "----receipt" + UUID.randomUUID().toString().replace("-", "");
            String filename = "image/png".equalsIgnoreCase(contentType) ? "receipt.png" : "receipt.jpg";
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(timeout)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipart(boundary, filename, contentType, content)))
                .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = response.body()) {
                if (response.statusCode() != 200) {
                    throw new ExtractionFailedException("OCR service returned an error");
                }
                body = in.readNBytes(MAX_RESPONSE_BYTES + 1);
            }
        } catch (ExtractionFailedException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExtractionFailedException("OCR request interrupted");
        } catch (HttpTimeoutException e) {
            throw new ExtractionFailedException("OCR service timed out");
        } catch (IOException | RuntimeException e) {
            throw new ExtractionFailedException("OCR service unreachable");
        }
        if (body.length > MAX_RESPONSE_BYTES) {
            throw new ExtractionFailedException("OCR response too large");
        }
        try {
            Body parsed = MAPPER.readValue(body, Body.class);
            if (parsed == null || parsed.lines() == null) {
                throw new IllegalArgumentException("no lines");
            }
            if (parsed.lines().size() > MAX_LINES) {
                throw new ExtractionFailedException("OCR response has too many lines");
            }
            List<OcrLine> lines = parsed.lines().stream().map(OcrHttpClient::toLine).toList();
            return new OcrDocument(parsed.width(), parsed.height(), lines);
        } catch (ExtractionFailedException e) {
            throw e;
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
