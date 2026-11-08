package com.vehiclepassport.server.shared.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** RFC 9457 problem body, matching the Problem schema in contracts/openapi.yaml. */
public record ProblemResponse(String type, String title, int status, String detail, String code) {

    public static final String MEDIA_TYPE = "application/problem+json";

    public static Response build(int status, String code, String detail) {
        Response.Status known = Response.Status.fromStatusCode(status);
        String title = known != null ? known.getReasonPhrase() : "Error";
        ProblemResponse body = new ProblemResponse("about:blank", title, status, detail, code);
        return Response.status(status).type(MediaType.valueOf(MEDIA_TYPE)).entity(body).build();
    }
}
