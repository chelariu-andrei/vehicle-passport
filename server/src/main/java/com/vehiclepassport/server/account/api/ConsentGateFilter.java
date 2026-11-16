package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.application.port.in.CheckConsentUseCase;
import com.vehiclepassport.server.shared.config.AccountConfig;
import com.vehiclepassport.server.shared.error.ProblemResponse;
import com.vehiclepassport.server.shared.security.CurrentUser;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Optional;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * Answers 403 consent-required on business endpoints until the caller has accepted the current terms and privacy
 * versions. Account, support and public endpoints stay open so the caller can accept and read the texts.
 */
public class ConsentGateFilter {

    private static final List<String> EXEMPT_PREFIXES = List.of("public/", "me/", "support/", "q/");
    private static final List<String> EXEMPT_EXACT = List.of("public", "me", "support", "q");

    @Inject
    AccountConfig config;
    @Inject
    SecurityIdentity identity;
    @Inject
    CurrentUser currentUser;
    @Inject
    CheckConsentUseCase consent;

    @ServerRequestFilter(priority = Priorities.AUTHORIZATION + 10)
    public Optional<Response> gate(ContainerRequestContext request) {
        if (!config.consent().enforce() || identity.isAnonymous() || exempt(request.getUriInfo().getPath())) {
            return Optional.empty();
        }
        if (consent.isCurrent(currentUser.id())) {
            return Optional.empty();
        }
        return Optional.of(ProblemResponse.build(403, "consent-required",
                "Accept the current terms and privacy policy to continue."));
    }

    static boolean exempt(String path) {
        String p = path.startsWith("/") ? path.substring(1) : path;
        return EXEMPT_EXACT.contains(p) || EXEMPT_PREFIXES.stream().anyMatch(p::startsWith);
    }
}
