package com.vehiclepassport.server.event.api;

import com.vehiclepassport.server.event.api.dto.AttachmentResponse;
import com.vehiclepassport.server.event.api.mapper.AttachmentDtoMapper;
import com.vehiclepassport.server.event.application.port.in.AddAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.ListAttachmentsUseCase;
import com.vehiclepassport.server.event.application.port.in.OpenAttachmentUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/vehicles/{vin}/events/{eventId}/attachments")
public class AttachmentResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    AttachmentDtoMapper mapper;
    @Inject
    AddAttachmentUseCase adding;
    @Inject
    ListAttachmentsUseCase listing;
    @Inject
    OpenAttachmentUseCase opening;
    @Inject
    DeleteAttachmentUseCase deleting;

    /**
     * The part arrives as a FileUpload: RESTEasy has spooled it to a local file before this method runs. The use
     * case holds a transaction while it reads the stream, so the stream must never be the network.
     */
    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response add(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId,
            @RestForm("file") @NotNull FileUpload file) throws IOException {
        AttachmentResponse body;
        try (InputStream in = Files.newInputStream(file.uploadedFile())) {
            body = mapper.toResponse(adding.add(currentUser.id(), vin, eventId,
                    mapper.toUpload(in, file.contentType(), file.size())));
        }
        return Response.status(Response.Status.CREATED).entity(body).build();
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<AttachmentResponse> list(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId) {
        return mapper.toResponse(listing.list(currentUser.id(), vin, eventId));
    }

    @GET
    @Path("{attachmentId}")
    public Response open(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId,
            @PathParam("attachmentId") UUID attachmentId) {
        return DocumentResponses.stream(opening.open(currentUser.id(), vin, eventId, attachmentId));
    }

    @DELETE
    @Path("{attachmentId}")
    public Response delete(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId,
            @PathParam("attachmentId") UUID attachmentId) {
        deleting.delete(currentUser.id(), vin, eventId, attachmentId);
        return Response.noContent().build();
    }
}
