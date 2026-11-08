package com.vehiclepassport.server.testsupport;

import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/")
@Produces(MediaType.TEXT_PLAIN)
public class TestPingResource {

    @Inject
    CurrentUser currentUser;

    @GET
    @Path("/test/ping")
    public String ping() {
        return currentUser.id().toString();
    }

    @GET
    @Path("/public/test-ping")
    public String publicPing() {
        return "pong";
    }
}
