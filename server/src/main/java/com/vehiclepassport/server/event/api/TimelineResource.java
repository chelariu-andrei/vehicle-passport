package com.vehiclepassport.server.event.api;

import com.vehiclepassport.server.event.api.dto.TimelinePageResponse;
import com.vehiclepassport.server.event.api.mapper.EventDtoMapper;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/vehicles/{vin}/timeline")
@Produces(MediaType.APPLICATION_JSON)
public class TimelineResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    EventDtoMapper mapper;
    @Inject
    GetTimelineUseCase timeline;

    /**
     * The limit is taken as text so that a non-numeric value fails validation (400) like an out-of-range one,
     * instead of JAX-RS answering 404 for a failed conversion. The contract allows 1..100.
     */
    @GET
    public TimelinePageResponse get(@PathParam("vin") String vin, @QueryParam("cursor") String cursor,
            @QueryParam("limit") @DefaultValue("20") @Pattern(regexp = "[1-9][0-9]?|100") String limit) {
        return mapper.toResponse(timeline.get(currentUser.id(), vin, cursor, Integer.parseInt(limit)));
    }
}
