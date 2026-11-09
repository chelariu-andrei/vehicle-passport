package com.vehiclepassport.server.event.application.port.out;

import com.vehiclepassport.server.event.application.port.in.EventDocument;

public interface DocumentStoragePort {

    /** Opens the stored file; throws EventNotFoundException when the key has no object. */
    EventDocument open(String key);
}
