package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface AddAttachmentUseCase {

    AttachmentView add(UUID userId, String vin, UUID eventId, AttachmentUpload file);
}
