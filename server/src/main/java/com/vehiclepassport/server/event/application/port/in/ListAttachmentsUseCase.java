package com.vehiclepassport.server.event.application.port.in;

import java.util.List;
import java.util.UUID;

public interface ListAttachmentsUseCase {

    /** Live attachments, oldest first. */
    List<AttachmentView> list(UUID userId, String vin, UUID eventId);
}
