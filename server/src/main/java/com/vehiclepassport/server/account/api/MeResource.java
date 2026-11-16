package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.MeResponse;
import com.vehiclepassport.server.account.api.dto.ProfilePatchRequest;
import com.vehiclepassport.server.account.api.mapper.ExportDtoMapper;
import com.vehiclepassport.server.account.api.mapper.MeDtoMapper;
import com.vehiclepassport.server.account.application.port.in.ExportMyDataUseCase;
import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.UpdateProfileUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/me")
@Produces(MediaType.APPLICATION_JSON)
public class MeResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    MeDtoMapper mapper;
    @Inject
    GetMeUseCase getting;
    @Inject
    UpdateProfileUseCase updating;
    @Inject
    ExportMyDataUseCase exporting;
    @Inject
    ExportDtoMapper exportMapper;

    @GET
    public MeResponse get() {
        return mapper.toResponse(getting.get(currentUser.id(), currentUser.email(), currentUser.emailVerified()));
    }

    @PATCH
    @Consumes(MediaType.APPLICATION_JSON)
    public MeResponse update(@NotNull ProfilePatchRequest request) {
        return mapper.toResponse(updating.update(currentUser.id(), mapper.toChange(request))
                .withEmailVerified(currentUser.emailVerified()));
    }

    @GET
    @Path("/export")
    public Response export() {
        var export = exporting.export(currentUser.id(), currentUser.email(), currentUser.emailVerified());
        return Response.ok(exportMapper.toResponse(export))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"vehicle-passport-export.json\"")
                .build();
    }
}
