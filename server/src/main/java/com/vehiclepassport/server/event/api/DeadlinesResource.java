package com.vehiclepassport.server.event.api;

import com.vehiclepassport.server.event.api.dto.DeadlinesResponse;
import com.vehiclepassport.server.event.api.mapper.EventDtoMapper;
import com.vehiclepassport.server.event.application.port.in.DeadlinesUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/vehicles/{vin}/deadlines")
@Produces(MediaType.APPLICATION_JSON)
public class DeadlinesResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    EventDtoMapper mapper;
    @Inject
    DeadlinesUseCase deadlines;

    @GET
    public DeadlinesResponse get(@PathParam("vin") String vin) {
        return mapper.toResponse(deadlines.get(currentUser.id(), vin));
    }
}
