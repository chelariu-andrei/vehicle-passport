package com.vehiclepassport.server.event.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;
import java.util.UUID;

public class DuplicateDocumentException extends DomainException {

    private final UUID existingEventId;

    /** existingEventId is null only when the other copy vanished before it could be looked up. */
    public DuplicateDocumentException(UUID existingEventId) {
        super(ErrorKind.CONFLICT, "duplicate-document", existingEventId == null
                ? "This document is already attached to another event"
                : "This document is already attached to event " + existingEventId);
        this.existingEventId = existingEventId;
    }

    public UUID existingEventId() {
        return existingEventId;
    }
}
