package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.ConsentHistoryResponse;
import com.vehiclepassport.server.account.api.dto.ConsentStatusDto;
import com.vehiclepassport.server.account.api.dto.ConsentUpdateRequest;
import com.vehiclepassport.server.account.api.mapper.ConsentDtoMapper;
import com.vehiclepassport.server.account.application.port.in.GetConsentStatusUseCase;
import com.vehiclepassport.server.account.application.port.in.ListConsentHistoryUseCase;
import com.vehiclepassport.server.account.application.port.in.RecordConsentUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/me/consents")
@Produces(MediaType.APPLICATION_JSON)
public class ConsentResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    ConsentDtoMapper mapper;
    @Inject
    GetConsentStatusUseCase status;
    @Inject
    RecordConsentUseCase recording;
    @Inject
    ListConsentHistoryUseCase history;

    @GET
    public ConsentStatusDto get() {
        return mapper.toDto(status.status(currentUser.id()));
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public ConsentStatusDto record(@NotNull @Valid ConsentUpdateRequest request) {
        return mapper.toDto(recording.record(currentUser.id(), mapper.toChange(request)));
    }

    @GET
    @Path("/history")
    public ConsentHistoryResponse history() {
        return mapper.toHistory(history.history(currentUser.id()));
    }
}
