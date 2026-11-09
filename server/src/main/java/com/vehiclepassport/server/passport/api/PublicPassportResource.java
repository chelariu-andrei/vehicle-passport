package com.vehiclepassport.server.passport.api;

import com.vehiclepassport.server.passport.api.dto.PublicPassportResponse;
import com.vehiclepassport.server.passport.api.mapper.PassportDtoMapper;
import com.vehiclepassport.server.passport.application.port.in.GetPassportPdfUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPublicPassportUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/** Unauthenticated. Cache-Control: no-store is added to every /public response by {@link PublicNoStoreFilter}. */
@Path("/public/passports/{token}")
public class PublicPassportResource {

    @Inject
    PassportDtoMapper mapper;
    @Inject
    GetPublicPassportUseCase reading;
    @Inject
    GetPassportPdfUseCase pdfs;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public PublicPassportResponse get(@PathParam("token") String token) {
        return mapper.toResponse(reading.get(token));
    }

    @GET
    @Path("pdf")
    @Produces("application/pdf")
    public byte[] pdf(@PathParam("token") String token) {
        return pdfs.publicPdf(token);
    }
}
