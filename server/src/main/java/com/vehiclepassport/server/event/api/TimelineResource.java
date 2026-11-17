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
import java.util.List;

@Path("/vehicles/{vin}/timeline")
@Produces(MediaType.APPLICATION_JSON)
public class TimelineResource {

    private static final String DATE = "\\d{4}-\\d{2}-\\d{2}";

    @Inject
    CurrentUser currentUser;
    @Inject
    EventDtoMapper mapper;
    @Inject
    GetTimelineUseCase timeline;

    /**
     * The limit and dates are taken as text so that a malformed value fails validation (400) like an out-of-range
     * one, instead of JAX-RS answering 404 for a failed conversion. The contract allows a limit of 1..100. Unknown
     * type or component names are refused by the application.
     */
    @GET
    public TimelinePageResponse get(@PathParam("vin") String vin, @QueryParam("cursor") String cursor,
            @QueryParam("limit") @DefaultValue("20") @Pattern(regexp = "[1-9][0-9]?|100") String limit,
            @QueryParam("type") List<String> types, @QueryParam("component") List<String> components,
            @QueryParam("from") @Pattern(regexp = DATE) String from,
            @QueryParam("to") @Pattern(regexp = DATE) String to,
            @QueryParam("order") @DefaultValue("asc") @Pattern(regexp = "asc|desc") String order) {
        return mapper.toResponse(timeline.get(mapper.toTimelineQuery(currentUser.id(), vin, types, components, from,
                to, order, cursor, Integer.parseInt(limit))));
    }
}
