package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.application.port.in.CheckErasedAccountUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import java.util.Optional;
import java.util.UUID;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * Answers 401 (empty body, like every 401 of this API) to a still valid access token whose account was purged, so
 * no endpoint provisions a fresh profile for it. Runs before the consent gate.
 */
public class ErasedAccountFilter {

    @Inject
    SecurityIdentity identity;
    @Inject
    CurrentUser currentUser;
    @Inject
    CheckErasedAccountUseCase erased;

    @ServerRequestFilter(priority = Priorities.AUTHORIZATION + 5)
    public Optional<Response> refuseErased(ContainerRequestContext request) {
        if (identity.isAnonymous()) {
            return Optional.empty();
        }
        UUID userId;
        try {
            userId = currentUser.id();
        } catch (NotAuthorizedException e) {
            // A subject that is not a user id is left to the endpoint, which answers 401 itself.
            return Optional.empty();
        }
        if (erased.isErased(userId)) {
            return Optional.of(Response.status(Response.Status.UNAUTHORIZED).build());
        }
        return Optional.empty();
    }
}
