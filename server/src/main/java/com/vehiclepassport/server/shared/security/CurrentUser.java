package com.vehiclepassport.server.shared.security;

import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotAuthorizedException;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

/** The authenticated user, identified by the UUID in the JWT subject. */
@RequestScoped
public class CurrentUser {

    @Inject
    JsonWebToken jwt;

    public UUID id() {
        String sub = jwt.getSubject();
        if (sub == null || sub.isBlank()) {
            throw unauthorized();
        }
        try {
            return UUID.fromString(sub);
        } catch (IllegalArgumentException e) {
            throw unauthorized();
        }
    }

    private static NotAuthorizedException unauthorized() {
        return new NotAuthorizedException("Bearer");
    }
}
