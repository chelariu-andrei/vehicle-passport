package com.vehiclepassport.server.shared.error;

import jakarta.annotation.Priority;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/**
 * A path or query parameter that cannot be converted (for example a non-UUID id) surfaces as a 404 with a cause,
 * and an unreadable body as a plain 400 without a body. Both answer 400 validation-failed. Every other framework status is unchanged.
 */
@Provider
@Priority(1)
public class BadRequestMapper implements ExceptionMapper<WebApplicationException> {

    @Override
    public Response toResponse(WebApplicationException e) {
        boolean unconvertible = e instanceof NotFoundException && e.getCause() != null;
        if (e.getResponse().getStatus() == 400 || unconvertible) {
            return ProblemResponse.build(400, "validation-failed", "Request is not valid");
        }
        return e.getResponse();
    }
}
