package com.vehiclepassport.server.scan.api;

import com.vehiclepassport.server.scan.api.dto.ConfirmScanRequest;
import com.vehiclepassport.server.scan.api.dto.ConfirmScanResponse;
import com.vehiclepassport.server.scan.api.dto.ScanBatchResponse;
import com.vehiclepassport.server.scan.api.dto.ScanJobResponse;
import com.vehiclepassport.server.scan.api.mapper.ScanDtoMapper;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.GetScanJobUseCase;
import com.vehiclepassport.server.scan.application.port.in.RejectScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanBatchUseCase;
import com.vehiclepassport.server.scan.application.port.in.SubmitScanUseCase;
import com.vehiclepassport.server.scan.application.port.in.UploadedFile;
import com.vehiclepassport.server.scan.domain.exception.MissingFileException;
import com.vehiclepassport.server.shared.security.CurrentUser;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/")
public class ScanResource {

    @Inject
    CurrentUser currentUser;
    @Inject
    ScanDtoMapper mapper;
    @Inject
    SubmitScanUseCase submitting;
    @Inject
    SubmitScanBatchUseCase submittingBatch;
    @Inject
    GetScanJobUseCase getting;
    @Inject
    ConfirmScanUseCase confirming;
    @Inject
    RejectScanUseCase rejecting;

    @POST
    @Path("vehicles/{vin}/scans")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response submit(@PathParam("vin") String vin, @RestForm("file") FileUpload file) {
        if (file == null) {
            throw new MissingFileException("multipart part 'file' is required");
        }
        ScanJobResponse body = mapper.toResponse(submitting.submit(currentUser.id(), vin, uploaded(file)));
        return Response.accepted(body).build();
    }

    @POST
    @Path("vehicles/{vin}/scan-batches")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response submitBatch(@PathParam("vin") String vin, @RestForm("files") List<FileUpload> files) {
        List<UploadedFile> uploads = files == null ? List.of() : files.stream().map(ScanResource::uploaded).toList();
        ScanBatchResponse body = mapper.toResponse(submittingBatch.submit(currentUser.id(), vin, uploads));
        return Response.accepted(body).build();
    }

    @GET
    @Path("scans/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    public ScanJobResponse get(@PathParam("jobId") UUID jobId) {
        return mapper.toResponse(getting.get(currentUser.id(), jobId));
    }

    @POST
    @Path("scans/{jobId}/confirm")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirm(@PathParam("jobId") UUID jobId, @Valid @NotNull ConfirmScanRequest request) {
        UUID currentId = currentUser.id();
        UUID eventId = confirming.confirm(mapper.toCommand(currentId, jobId, request));
        return Response.status(Response.Status.CREATED).entity(new ConfirmScanResponse(eventId)).build();
    }

    @POST
    @Path("scans/{jobId}/reject")
    public Response reject(@PathParam("jobId") UUID jobId) {
        rejecting.reject(currentUser.id(), jobId);
        return Response.noContent().build();
    }

    /** The client file name is never read: only the content type and the size measured on the received file. */
    private static UploadedFile uploaded(FileUpload upload) {
        return new UploadedFile(upload.uploadedFile(), declaredType(upload.contentType()), upload.size());
    }

    private static String declaredType(String contentType) {
        if (contentType == null) {
            return null;
        }
        int semicolon = contentType.indexOf(';');
        String bare = semicolon < 0 ? contentType : contentType.substring(0, semicolon);
        return bare.trim().toLowerCase(Locale.ROOT);
    }
}
