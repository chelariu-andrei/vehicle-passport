package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.DeletionStatusDto;
import com.vehiclepassport.server.account.application.port.in.CancelDeletionUseCase;
import com.vehiclepassport.server.account.application.port.in.ScheduleDeletionUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/me/deletion")
@Produces(MediaType.APPLICATION_JSON)
public class DeletionResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    ScheduleDeletionUseCase scheduling;
    @Inject
    CancelDeletionUseCase cancelling;

    @POST
    public Response schedule() {
        return Response.status(Response.Status.CREATED)
                .entity(new DeletionStatusDto(scheduling.schedule(currentUser.id()))).build();
    }

    @DELETE
    public Response cancel() {
        cancelling.cancel(currentUser.id());
        return Response.noContent().build();
    }
}
