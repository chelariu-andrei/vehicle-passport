package com.vehiclepassport.server.scan.infrastructure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.scan.domain.exception.ExtractionFailedException;
import com.vehiclepassport.server.scan.infrastructure.client.NoProviderExtractionAdapter;
import com.vehiclepassport.server.scan.infrastructure.client.OcrHttpClient;
import com.vehiclepassport.server.scan.infrastructure.client.PaddleOcrExtractionAdapter;
import com.vehiclepassport.server.scan.infrastructure.client.ReceiptExtractionProducer;
import com.vehiclepassport.server.shared.config.ScanConfig;
import com.vehiclepassport.server.testsupport.fake.OcrStubServer;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PaddleOcrExtractionAdapterTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};

    private OcrStubServer stub;
    private PaddleOcrExtractionAdapter adapter;

    @BeforeEach
    void open() {
        stub = OcrStubServer.start();
        adapter = new PaddleOcrExtractionAdapter(new OcrHttpClient(stub.uri(), Duration.ofSeconds(2)));
    }

    @AfterEach
    void close() {
        stub.close();
    }

    private ExtractionFailedException fails() {
        return assertThrows(ExtractionFailedException.class, () -> adapter.extract(PNG, "image/png"));
    }

    private static ScanConfig config(String provider) {
        return new ScanConfig() {
            @Override public int maxAttempts() { return 3; }
            @Override public Duration processingTimeout() { return Duration.ofMinutes(5); }
            @Override public int workerBatchSize() { return 10; }
            @Override public Extraction extraction() { return () -> provider; }
            @Override public Ocr ocr() {
                return new Ocr() {
                    @Override public String baseUrl() { return "http://127.0.0.1:1"; }
                    @Override public Duration timeout() { return Duration.ofSeconds(1); }
                };
            }
        };
    }

    @Test void posts_a_named_multipart_file_and_parses_the_response() {
        stub.respond(200, """
            {"width":10,"height":10,"lines":[{"text":"TOTAL GENERAL 10,00","score":0.9,"box":[0,0,9,9],"poly":[[0,0],[9,0],[9,9],[0,9]]}]}""");
        var x = adapter.extract(PNG, "image/png");
        assertEquals(new BigDecimal("10.00"), x.result().total().value());
        assertTrue(stub.lastBody().contains("name=\"file\"; filename="));
        assertTrue(stub.lastBody().contains("Content-Type: image/png"));
    }

    @Test void unknown_response_fields_are_tolerated() {
        stub.respond(200, """
            {"model":"x","width":10,"height":10,"lines":[{"text":"TOTAL GENERAL 10,00","score":0.9,"box":[0,0,9,9],"extra":1}]}""");
        assertEquals(new BigDecimal("10.00"), adapter.extract(PNG, "image/png").result().total().value());
    }

    @Test void no_text_lines_fail_the_extraction() {
        stub.respond(200, "{\"width\":10,\"height\":10,\"lines\":[]}");
        assertEquals("no text found", fails().getMessage());
    }

    @ParameterizedTest @ValueSource(ints = {400, 413, 415, 422, 500, 503})
    void error_statuses_fail_the_extraction(int status) {
        stub.respond(status, "{}");
        fails();
    }

    @ParameterizedTest @ValueSource(strings = {"not json", "{}", "{\"lines\":null}",
        "{\"width\":1,\"height\":1,\"lines\":[{\"text\":null,\"score\":0.9,\"box\":[0,0,1,1]}]}",
        "{\"width\":1,\"height\":1,\"lines\":[{\"text\":\"x\",\"score\":0.9,\"box\":[0,0]}]}"})
    void malformed_bodies_fail_the_extraction(String body) {
        stub.respond(200, body);
        fails();
    }

    @Test void an_out_of_range_score_is_clamped_not_fatal() {
        stub.respond(200, "{\"width\":1,\"height\":1,\"lines\":[{\"text\":\"TOTAL GENERAL 10,00\",\"score\":1.5,\"box\":[0,0,1,1]}]}");
        assertEquals(1.0, adapter.extract(PNG, "image/png").result().total().confidence(), 1e-9);
    }

    @Test void a_slow_service_times_out() {
        stub.delay(Duration.ofSeconds(4));
        stub.respond(200, "{}");
        fails();
    }

    @Test void an_unreachable_service_fails() {
        var dead = new PaddleOcrExtractionAdapter(
            new OcrHttpClient(URI.create("http://127.0.0.1:1"), Duration.ofSeconds(2)));
        assertThrows(ExtractionFailedException.class, () -> dead.extract(PNG, "image/png"));
    }

    @Test void pdf_fails_without_calling_ocr() {
        assertThrows(ExtractionFailedException.class, () -> adapter.extract(new byte[] {1}, "application/pdf"));
        assertEquals(0, stub.calls());
    }

    @Test void failure_messages_never_contain_response_text() {
        stub.respond(500, "SECRET-INVOICE-TEXT");
        assertFalse(fails().getMessage().contains("SECRET"));
    }

    @Test void producer_selects_by_flag() {
        assertInstanceOf(PaddleOcrExtractionAdapter.class, new ReceiptExtractionProducer(config("paddle")).port());
        assertInstanceOf(NoProviderExtractionAdapter.class, new ReceiptExtractionProducer(config("none")).port());
    }
}
