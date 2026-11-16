package com.vehiclepassport.server.account.infrastructure.client;

import com.vehiclepassport.server.account.application.port.out.IdentityAdminPort;
import com.vehiclepassport.server.shared.config.SupabaseAdminConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/** Deletes users through the Supabase Auth admin API with the service-role key (environment only). */
@ApplicationScoped
public class SupabaseAdminClient implements IdentityAdminPort {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final SupabaseAdminConfig config;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    @Inject
    public SupabaseAdminClient(SupabaseAdminConfig config) {
        this.config = config;
    }

    @Override
    public void deleteUser(UUID userId) {
        String key = config.serviceRoleKey().filter(k -> !k.isBlank())
                .orElseThrow(() -> new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is not configured"));
        String base = config.url().endsWith("/") ? config.url().substring(0, config.url().length() - 1) : config.url();
        HttpRequest request = HttpRequest.newBuilder(URI.create(base + "/auth/v1/admin/users/" + userId))
                .timeout(TIMEOUT)
                .header("apikey", key)
                .header("Authorization", "Bearer " + key)
                .DELETE()
                .build();
        int status;
        try {
            status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (IOException e) {
            throw new IllegalStateException("Supabase admin call failed: " + e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Supabase admin call interrupted");
        }
        if (status == 404 || (status >= 200 && status < 300)) {
            return;
        }
        throw new IllegalStateException("Supabase admin call answered " + status);
    }
}
