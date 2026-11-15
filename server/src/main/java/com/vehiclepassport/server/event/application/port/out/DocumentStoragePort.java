package com.vehiclepassport.server.event.application.port.out;

import com.vehiclepassport.server.event.application.port.in.EventDocument;
import java.nio.file.Path;

public interface DocumentStoragePort {

    /** Opens the stored file; throws EventNotFoundException when the key has no object. */
    EventDocument open(String key);

    /** Stores the file under the key, streaming it from disk. */
    void put(String key, Path file, String contentType);

    /** Removes the object; a missing key is not an error. */
    void delete(String key);
}
