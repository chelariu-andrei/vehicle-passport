package com.vehiclepassport.server.account.infrastructure;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpServer;
import com.vehiclepassport.server.account.infrastructure.client.SupabaseAdminClient;
import com.vehiclepassport.server.shared.config.SupabaseAdminConfig;
import java.net.InetSocketAddress;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SupabaseAdminClientTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-0000000000c9");

    private HttpServer server;
    private int status = 200;
    private final AtomicReference<String> method = new AtomicReference<>();
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> auth = new AtomicReference<>();
    private final AtomicReference<String> apikey = new AtomicReference<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            method.set(exchange.getRequestMethod());
            path.set(exchange.getRequestURI().getPath());
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            apikey.set(exchange.getRequestHeaders().getFirst("apikey"));
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private SupabaseAdminClient client(String key) {
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        return new SupabaseAdminClient(new SupabaseAdminConfig() {
            public String url() { return url; }

            public Optional<String> serviceRoleKey() { return Optional.ofNullable(key); }
        });
    }

    @Test
    void deletesTheAuthUserWithTheServiceRoleKey() {
        status = 200;
        client("srk").deleteUser(USER);
        assertEquals("DELETE", method.get());
        assertEquals("/auth/v1/admin/users/" + USER, path.get());
        assertEquals("Bearer srk", auth.get());
        assertEquals("srk", apikey.get());
    }

    @Test
    void unknownUserCountsAsSuccess() {
        status = 404;
        assertDoesNotThrow(() -> client("srk").deleteUser(USER));
    }

    @Test
    void serverErrorFailsSoThePurgeRetries() {
        status = 500;
        assertThrows(IllegalStateException.class, () -> client("srk").deleteUser(USER));
    }

    @Test
    void missingServiceRoleKeyFailsInsteadOfSkipping() {
        assertThrows(IllegalStateException.class, () -> client(null).deleteUser(USER));
        assertThrows(IllegalStateException.class, () -> client("  ").deleteUser(USER));
    }
}
