package com.vehiclepassport.server.event.api.mapper;

import com.vehiclepassport.server.event.api.dto.AttachmentResponse;
import com.vehiclepassport.server.event.application.port.in.AttachmentUpload;
import com.vehiclepassport.server.event.application.port.in.AttachmentView;
import com.vehiclepassport.server.shared.util.UploadPolicy;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.InputStream;
import java.util.List;

@ApplicationScoped
public class AttachmentDtoMapper {

    /** The client file name is never read: only the declared content type and the size of the received file. */
    public AttachmentUpload toUpload(InputStream content, String declaredContentType, long receivedSize) {
        return new AttachmentUpload(content, UploadPolicy.bareType(declaredContentType), receivedSize);
    }

    public AttachmentResponse toResponse(AttachmentView v) {
        return new AttachmentResponse(v.id(), v.contentType(), v.sizeBytes(), v.sha256(), v.kind(), v.createdAt());
    }

    public List<AttachmentResponse> toResponse(List<AttachmentView> views) {
        return views.stream().map(this::toResponse).toList();
    }
}
