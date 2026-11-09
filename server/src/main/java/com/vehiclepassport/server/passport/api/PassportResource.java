package com.vehiclepassport.server.passport.api;

import com.vehiclepassport.server.passport.api.dto.CreatePassportRequest;
import com.vehiclepassport.server.passport.api.dto.PassportResponse;
import com.vehiclepassport.server.passport.api.mapper.PassportDtoMapper;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportPdfUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportQrUseCase;
import com.vehiclepassport.server.passport.application.port.in.ListMyPassportsUseCase;
import com.vehiclepassport.server.passport.application.port.in.RevokePassportLinkUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/")
public class PassportResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    PassportDtoMapper mapper;
    @Inject
    CreatePassportUseCase creating;
    @Inject
    ListMyPassportsUseCase listing;
    @Inject
    RevokePassportLinkUseCase revoking;
    @Inject
    GetPassportPdfUseCase pdfs;
    @Inject
    GetPassportQrUseCase qrs;

    @POST
    @Path("vehicles/{vin}/passports")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@PathParam("vin") String vin, CreatePassportRequest request) {
        return created(vin, request == null ? null : request.expiresAt());
    }

    /** The body is optional in the contract: a request without a content type means no expiry. */
    @POST
    @Path("vehicles/{vin}/passports")
    @Produces(MediaType.APPLICATION_JSON)
    public Response createWithoutBody(@PathParam("vin") String vin) {
        return created(vin, null);
    }

    private Response created(String vin, Instant expiresAt) {
        PassportResponse body = mapper.toResponse(creating.create(currentUser.id(), vin, expiresAt));
        return Response.status(Response.Status.CREATED).entity(body).build();
    }

    @GET
    @Path("passports")
    @Produces(MediaType.APPLICATION_JSON)
    public List<PassportResponse> list() {
        return listing.list(currentUser.id()).stream().map(mapper::toResponse).toList();
    }

    @POST
    @Path("passports/{id}/revoke")
    public Response revoke(@PathParam("id") UUID id) {
        revoking.revoke(currentUser.id(), id);
        return Response.noContent().build();
    }

    @GET
    @Path("passports/{id}/pdf")
    @Produces("application/pdf")
    public byte[] pdf(@PathParam("id") UUID id) {
        return pdfs.ownerPdf(currentUser.id(), id);
    }

    @GET
    @Path("passports/{id}/qr")
    @Produces("image/png")
    public byte[] qr(@PathParam("id") UUID id) {
        return qrs.ownerQr(currentUser.id(), id);
    }
}
