package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.SettingsDto;
import com.vehiclepassport.server.account.api.mapper.SettingsDtoMapper;
import com.vehiclepassport.server.account.application.port.in.GetSettingsUseCase;
import com.vehiclepassport.server.account.application.port.in.UpdateSettingsUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/me/settings")
@Produces(MediaType.APPLICATION_JSON)
public class SettingsResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    SettingsDtoMapper mapper;
    @Inject
    GetSettingsUseCase getting;
    @Inject
    UpdateSettingsUseCase updating;

    @GET
    public SettingsDto get() {
        return mapper.toDto(getting.get(currentUser.id()));
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public SettingsDto replace(@NotNull @Valid SettingsDto request) {
        return mapper.toDto(updating.replace(currentUser.id(), mapper.toDomain(request)));
    }
}
