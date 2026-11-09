package com.vehiclepassport.server.shared.error;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import jakarta.annotation.Priority;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Malformed JSON, wrong field types, bad dates and unknown fields all answer 400 validation-failed. */
@Provider
@Priority(1)
public class MalformedRequestMapper implements ExceptionMapper<JsonProcessingException> {

    @Override
    public Response toResponse(JsonProcessingException e) {
        return ProblemResponse.build(400, "validation-failed", "Request body is not valid: " + e.getOriginalMessage());
    }

    /** Overrides the framework's built-in mapper for type mismatches and unknown fields. */
    @Provider
    @Priority(1)
    public static class Mismatched implements ExceptionMapper<MismatchedInputException> {

        @Override
        public Response toResponse(MismatchedInputException e) {
            return ProblemResponse.build(400, "validation-failed",
                    "Request body is not valid: " + e.getOriginalMessage());
        }
    }
}
