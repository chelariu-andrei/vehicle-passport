package com.vehiclepassport.server.vehicle.api;

import com.vehiclepassport.server.shared.security.CurrentUser;
import com.vehiclepassport.server.vehicle.api.dto.PendingClaimResponse;
import com.vehiclepassport.server.vehicle.api.dto.RegisterVehicleRequest;
import com.vehiclepassport.server.vehicle.api.dto.UpdateVehicleRequest;
import com.vehiclepassport.server.vehicle.api.dto.VehicleResponse;
import com.vehiclepassport.server.vehicle.api.mapper.VehicleDtoMapper;
import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.FileOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.ListMyVehiclesUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.ClaimFiled;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.Registered;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegistrationResult;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;

@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class VehicleResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    VehicleDtoMapper mapper;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    ListMyVehiclesUseCase listing;
    @Inject
    GetVehicleUseCase getting;
    @Inject
    UpdateVehicleUseCase updating;
    @Inject
    ReleaseVehicleUseCase releasing;
    @Inject
    DecideOwnershipClaimUseCase deciding;
    @Inject
    FileOwnershipClaimUseCase filing;

    @POST
    @Path("vehicles")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response register(@Valid @NotNull RegisterVehicleRequest request) {
        RegistrationResult result = registering.register(mapper.toCommand(currentUser.id(), request));
        if (result instanceof Registered registered) {
            return Response.status(Response.Status.CREATED).entity(mapper.toResponse(registered.vehicle())).build();
        }
        return Response.accepted(mapper.toResponse((ClaimFiled) result)).build();
    }

    @GET
    @Path("vehicles")
    public List<VehicleResponse> list() {
        return listing.list(currentUser.id()).stream().map(mapper::toResponse).toList();
    }

    @GET
    @Path("vehicles/{vin}")
    public VehicleResponse get(@PathParam("vin") String vin) {
        return mapper.toResponse(getting.get(vin, currentUser.id()));
    }

    @PATCH
    @Path("vehicles/{vin}")
    @Consumes(MediaType.APPLICATION_JSON)
    public VehicleResponse update(@PathParam("vin") String vin, @Valid @NotNull UpdateVehicleRequest request) {
        UUID userId = currentUser.id();
        VehicleView current = getting.get(vin, userId);
        return mapper.toResponse(updating.update(mapper.toCommand(userId, vin, request, current)));
    }

    @POST
    @Path("vehicles/{vin}/release")
    public Response release(@PathParam("vin") String vin) {
        releasing.release(vin, currentUser.id());
        return Response.noContent().build();
    }

    @GET
    @Path("vehicles/{vin}/claims")
    public List<PendingClaimResponse> pendingClaims(@PathParam("vin") String vin) {
        return deciding.listPending(vin, currentUser.id()).stream().map(mapper::toResponse).toList();
    }

    @POST
    @Path("vehicles/{vin}/claims/{claimId}/approve")
    public Response approve(@PathParam("vin") String vin, @PathParam("claimId") UUID claimId) {
        deciding.approve(vin, claimId, currentUser.id());
        return Response.noContent().build();
    }

    @POST
    @Path("vehicles/{vin}/claims/{claimId}/reject")
    public Response reject(@PathParam("vin") String vin, @PathParam("claimId") UUID claimId) {
        deciding.reject(vin, claimId, currentUser.id());
        return Response.noContent().build();
    }

    @POST
    @Path("ownership-claims/{claimId}/withdraw")
    public Response withdraw(@PathParam("claimId") UUID claimId) {
        filing.withdraw(claimId, currentUser.id());
        return Response.noContent().build();
    }
}
