package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface OpenAttachmentUseCase {

    /** The stored file; the caller must close the stream. */
    EventDocument open(UUID userId, String vin, UUID eventId, UUID attachmentId);
}
