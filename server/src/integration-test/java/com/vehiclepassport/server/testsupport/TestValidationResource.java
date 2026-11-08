package com.vehiclepassport.server.testsupport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MediaType;

@Path("/test/validate")
public class TestValidationResource {

    public record Body(@NotBlank String name) {
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public void validate(@Valid Body body) {
    }
}
