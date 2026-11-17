package com.vehiclepassport.server.fuel.api;

import com.vehiclepassport.server.fuel.api.dto.FuelStatsResponse;
import com.vehiclepassport.server.fuel.api.mapper.FuelDtoMapper;
import com.vehiclepassport.server.fuel.application.port.in.GetFuelStatsUseCase;
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

@Path("/vehicles/{vin}/fuel/stats")
@Produces(MediaType.APPLICATION_JSON)
public class FuelStatsResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    FuelDtoMapper mapper;
    @Inject
    GetFuelStatsUseCase stats;

    /** The period is text with the contract's values, so an unknown one answers 400 validation-failed. */
    @GET
    public FuelStatsResponse get(@PathParam("vin") String vin,
            @QueryParam("period") @DefaultValue("6m") @Pattern(regexp = "3m|6m|12m|all") String period) {
        return mapper.toResponse(stats.stats(currentUser.id(), vin, period));
    }
}
