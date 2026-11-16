package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.SupportReportRequest;
import com.vehiclepassport.server.account.api.dto.SupportReportResponse;
import com.vehiclepassport.server.account.application.port.in.CreateSupportReportUseCase;
import com.vehiclepassport.server.account.domain.model.SupportDiagnostics;
import com.vehiclepassport.server.account.domain.model.SupportKind;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/support/reports")
@Produces(MediaType.APPLICATION_JSON)
public class SupportResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    CreateSupportReportUseCase creating;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@NotNull @Valid SupportReportRequest request) {
        SupportReport report = new SupportReport(SupportKind.fromValue(request.kind()), request.message(),
                request.includeDiagnostics(), diagnostics(request.diagnostics()));
        return Response.status(Response.Status.CREATED)
                .entity(new SupportReportResponse(creating.create(currentUser.id(), report))).build();
    }

    private static SupportDiagnostics diagnostics(SupportReportRequest.Diagnostics d) {
        return d == null ? null : new SupportDiagnostics(d.appVersion(), d.platform(), d.osVersion(), d.deviceModel());
    }
}
