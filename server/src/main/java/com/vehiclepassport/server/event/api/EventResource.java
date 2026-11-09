package com.vehiclepassport.server.event.api;

import com.vehiclepassport.server.event.api.dto.EventRequest;
import com.vehiclepassport.server.event.api.dto.EventResponse;
import com.vehiclepassport.server.event.api.mapper.EventDtoMapper;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.in.GetEventDocumentUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.InputStream;
import java.util.UUID;

@Path("/vehicles/{vin}/events")
public class EventResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    EventDtoMapper mapper;
    @Inject
    AddEventUseCase adding;
    @Inject
    UpdateEventUseCase updating;
    @Inject
    DeleteEventUseCase deleting;
    @Inject
    GetEventDocumentUseCase documents;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response add(@PathParam("vin") String vin, @Valid EventRequest request) {
        EventResponse body = mapper.toResponse(adding.add(mapper.toAddCommand(currentUser.id(), vin, request)));
        return Response.status(Response.Status.CREATED).entity(body).build();
    }

    @PUT
    @Path("{eventId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public EventResponse update(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId,
            @Valid EventRequest request) {
        return mapper.toResponse(updating.update(mapper.toUpdateCommand(currentUser.id(), vin, eventId, request)));
    }

    @DELETE
    @Path("{eventId}")
    public Response delete(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId) {
        deleting.delete(currentUser.id(), vin, eventId);
        return Response.noContent().build();
    }

    @GET
    @Path("{eventId}/document")
    public Response document(@PathParam("vin") String vin, @PathParam("eventId") UUID eventId) {
        EventDocument document = documents.get(currentUser.id(), vin, eventId);
        StreamingOutput stream = out -> {
            try (InputStream in = document.content()) {
                in.transferTo(out);
            }
        };
        return Response.ok(stream, document.contentType()).build();
    }
}
