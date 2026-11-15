package com.vehiclepassport.server.testsupport.fake;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/** A stand-in for the OCR service on 127.0.0.1 with a random port. A plain class, not a CDI bean. */
public final class OcrStubServer implements AutoCloseable {

    private final HttpServer server;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final AtomicInteger calls = new AtomicInteger();
    private volatile int status = 200;
    private volatile String json = "{}";
    private volatile Duration delay = Duration.ZERO;
    private volatile Duration stall = Duration.ZERO;
    private volatile String lastBody = "";

    private OcrStubServer(HttpServer server) {
        this.server = server;
    }

    public static OcrStubServer start() {
        try {
            HttpServer http = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            OcrStubServer stub = new OcrStubServer(http);
            http.createContext("/ocr", exchange -> {
                try (exchange) {
                    stub.calls.incrementAndGet();
                    stub.lastBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1);
                    Duration wait = stub.delay;
                    if (!wait.isZero()) {
                        try {
                            Thread.sleep(wait.toMillis());
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                    }
                    byte[] out = stub.json.getBytes(StandardCharsets.UTF_8);
                    Duration pause = stub.stall;
                    if (!pause.isZero()) {
                        // headers and the first half of the body go out, then the server stalls
                        exchange.getResponseHeaders().add("Content-Type", "application/json");
                        exchange.sendResponseHeaders(stub.status, 0);
                        exchange.getResponseBody().write(out, 0, out.length / 2);
                        exchange.getResponseBody().flush();
                        try {
                            Thread.sleep(pause.toMillis());
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                        exchange.getResponseBody().write(out, out.length / 2, out.length - out.length / 2);
                        return;
                    }
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(stub.status, out.length);
                    exchange.getResponseBody().write(out);
                } catch (IOException ignored) {
                    // the client may have given up already (timeout test)
                }
            });
            http.setExecutor(stub.executor);
            http.start();
            return stub;
        } catch (IOException e) {
            throw new IllegalStateException("cannot start the OCR stub", e);
        }
    }

    public void respond(int status, String json) {
        this.status = status;
        this.json = json;
    }

    public void delay(Duration delay) {
        this.delay = delay;
    }

    /** After the response headers and half the body, the server stalls this long (released by close()). */
    public void stallAfterHeaders(Duration stall) {
        this.stall = stall;
    }

    public String lastBody() {
        return lastBody;
    }

    public int calls() {
        return calls.get();
    }

    public URI uri() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    @Override
    public void close() {
        server.stop(0);
        executor.shutdownNow();
    }
}
