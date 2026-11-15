package com.vehiclepassport.server.scan.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vehiclepassport.server.scan.application.port.in.GetScanJobUseCase;
import com.vehiclepassport.server.scan.application.port.in.ProcessScanJobsUseCase;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.infrastructure.client.OcrHttpClient;
import com.vehiclepassport.server.scan.infrastructure.client.PaddleOcrExtractionAdapter;
import com.vehiclepassport.server.testsupport.Resettable;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakeReceiptExtraction;
import com.vehiclepassport.server.testsupport.fake.OcrStubServer;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.util.List;

@ApplicationScoped
public class OcrExtractionSteps implements Resettable {

    private static final String JOB_KEY = "scan.job";
    private static final String FIXTURE = "ocr/printed-deviz.json";
    private static final Duration TIMEOUT = Duration.ofSeconds(2);
    private static final ObjectMapper JSON = new ObjectMapper();

    @Inject
    World world;

    @Inject
    FakeReceiptExtraction extraction;

    @Inject
    ProcessScanJobsUseCase worker;

    @Inject
    GetScanJobUseCase getJob;

    private OcrStubServer stub;

    @Given("the OCR service returns the lines of a printed deviz")
    public void theOcrServiceReturnsADeviz() {
        serve(fixture());
    }

    @Given("a deviz without a kilometraj label")
    public void aDevizWithoutKilometraj() {
        ObjectNode doc = fixture();
        for (JsonNode line : doc.get("lines")) {
            assertFalse(line.get("text").asText().toLowerCase().contains("km"), "the fixture must have no kilometraj");
        }
        serve(doc);
        worker.processPending();
    }

    @Given("the total was read with score {double}")
    public void theTotalWasReadWithScore(double score) {
        ObjectNode doc = fixture();
        boolean found = false;
        for (JsonNode line : doc.get("lines")) {
            if ("1.687,95".equals(line.get("text").asText())) {
                ((ObjectNode) line).put("score", score);
                found = true;
            }
        }
        assertTrue(found, "the total line is in the fixture");
        serve(doc);
        worker.processPending();
    }

    @Given("an invoice line reads {string}")
    public void anInvoiceLineReads(String text) {
        ObjectNode doc = fixture();
        ObjectNode line = JSON.createObjectNode();
        line.put("text", text);
        line.put("score", 0.98);
        line.set("box", JSON.valueToTree(new int[] {40, 1050, 500, 1070}));
        ((ArrayNode) doc.get("lines")).add(line);
        serve(doc);
        worker.processPending();
    }

    @Given("the OCR service is unreachable")
    public void theOcrServiceIsUnreachable() {
        // a valid URL with nothing listening on it
        install(URI.create("http://127.0.0.1:1"));
    }

    @When("the scan job is processed")
    public void theScanJobIsProcessed() {
        worker.processPending();
    }

    @Then("labor, parts and total are extracted with confidence from the OCR scores")
    public void laborPartsAndTotalAreExtracted() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        ScanResult r = view.result();
        assertEquals(new BigDecimal("350.00"), r.labor().value());
        assertEquals(new BigDecimal("1687.95"), r.total().value());
        assertEquals(2, r.parts().value().size());
        assertEquals(0.98, r.labor().confidence(), 1e-9);
        assertEquals(0.98, r.parts().confidence(), 1e-9);
        assertEquals(0.98, r.total().confidence(), 1e-9);
    }

    @Then("odometerKm is empty with confidence 0 and nothing is invented")
    public void odometerIsEmpty() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        assertNull(view.result().odometerKm().value());
        assertEquals(0.0, view.result().odometerKm().confidence(), 0.0);
    }

    @Then("total is empty and a LOW_CONFIDENCE_READ warning is attached")
    public void totalIsEmptyWithWarning() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        assertNull(view.result().total().value());
        assertEquals(0.0, view.result().total().confidence(), 0.0);
        assertTrue(view.warnings().contains("LOW_CONFIDENCE_READ"), view.warnings().toString());
    }

    @Then("no field changes and the line is not used as a value")
    public void noFieldChanges() {
        ScanJobView view = currentJob();
        assertEquals("EXTRACTED", view.status());
        ScanResult r = view.result();
        assertEquals(new BigDecimal("1687.95"), r.total().value());
        assertEquals(new BigDecimal("350.00"), r.labor().value());
        assertEquals("AUTO EXPERT SRL", r.serviceName().value());
        assertEquals(List.of("Filtru ulei", "Ulei motor 5W30"),
            r.parts().value().stream().map(ExtractedPart::name).toList());
        assertFalse(r.toString().toLowerCase().contains("ignore"), r.toString());
    }

    @Then("the job is retried and ends FAILED after 3 attempts")
    public void theJobIsRetriedAndFails() {
        for (int i = 0; i < 3; i++) {
            worker.processPending();
        }
        assertEquals("FAILED", currentJob().status());
        assertEquals(3, extraction.calls());
    }

    @Override
    public void reset() {
        closeStub();
    }

    private void serve(ObjectNode doc) {
        closeStub();
        stub = OcrStubServer.start();
        stub.respond(200, doc.toString());
        install(stub.uri());
    }

    private void install(URI base) {
        extraction.willDelegateTo(new PaddleOcrExtractionAdapter(new OcrHttpClient(base, TIMEOUT)));
    }

    private void closeStub() {
        if (stub != null) {
            stub.close();
            stub = null;
        }
    }

    private ScanJobView currentJob() {
        ScanJobView view = world.get(JOB_KEY);
        return getJob.get(world.me(), view.id());
    }

    private static ObjectNode fixture() {
        try (InputStream in = OcrExtractionSteps.class.getClassLoader().getResourceAsStream(FIXTURE)) {
            assertNotNull(in, FIXTURE);
            return (ObjectNode) JSON.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
