package com.vehiclepassport.server.fuel.api;

import com.vehiclepassport.server.fuel.api.dto.FuelEntryPageResponse;
import com.vehiclepassport.server.fuel.api.dto.FuelEntryRequest;
import com.vehiclepassport.server.fuel.api.dto.FuelEntryResponse;
import com.vehiclepassport.server.fuel.api.mapper.FuelDtoMapper;
import com.vehiclepassport.server.fuel.application.port.in.AddFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.DeleteFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesUseCase;
import com.vehiclepassport.server.fuel.application.port.in.UpdateFuelEntryUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/vehicles/{vin}/fuel-entries")
public class FuelResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    FuelDtoMapper mapper;
    @Inject
    AddFuelEntryUseCase adding;
    @Inject
    UpdateFuelEntryUseCase updating;
    @Inject
    DeleteFuelEntryUseCase deleting;
    @Inject
    ListFuelEntriesUseCase listing;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response add(@PathParam("vin") String vin, @Valid @NotNull FuelEntryRequest request) {
        FuelEntryResponse body = mapper.toResponse(adding.add(mapper.toCommand(currentUser.id(), vin, null,
                request)));
        return Response.status(Response.Status.CREATED).entity(body).build();
    }

    /**
     * The limit is taken as text so that a malformed value fails validation (400) like an out-of-range one, as on
     * the timeline. The contract allows 1..100, default 30. A malformed cursor is refused by the application.
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public FuelEntryPageResponse list(@PathParam("vin") String vin, @QueryParam("cursor") String cursor,
            @QueryParam("limit") @DefaultValue("30") @Pattern(regexp = "[1-9][0-9]?|100") String limit) {
        return mapper.toResponse(listing.list(currentUser.id(), vin, cursor, Integer.parseInt(limit)));
    }

    @PUT
    @Path("{entryId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public FuelEntryResponse update(@PathParam("vin") String vin, @PathParam("entryId") UUID entryId,
            @Valid @NotNull FuelEntryRequest request) {
        return mapper.toResponse(updating.update(mapper.toCommand(currentUser.id(), vin, entryId, request)));
    }

    @DELETE
    @Path("{entryId}")
    public Response delete(@PathParam("vin") String vin, @PathParam("entryId") UUID entryId) {
        deleting.delete(currentUser.id(), vin, entryId);
        return Response.noContent().build();
    }
}
