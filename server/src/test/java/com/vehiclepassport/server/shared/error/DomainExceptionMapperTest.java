package com.vehiclepassport.server.shared.error;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

class DomainExceptionMapperTest {

    private static final class AlreadyOwner extends DomainException {
        AlreadyOwner() {
            super(ErrorKind.CONFLICT, "already-owner", "x");
        }
    }

    @Test
    void maps_kind_to_status_and_problem_body() {
        Response response = new DomainExceptionMapper().toResponse(new AlreadyOwner());

        assertEquals(409, response.getStatus());
        assertEquals("application/problem+json", response.getMediaType().toString());
        ProblemResponse body = (ProblemResponse) response.getEntity();
        assertEquals("already-owner", body.code());
        assertEquals(409, body.status());
        assertEquals("x", body.detail());
    }
}
