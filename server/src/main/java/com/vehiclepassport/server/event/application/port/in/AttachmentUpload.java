package com.vehiclepassport.server.event.application.port.in;

import java.io.InputStream;

/** An uploaded file. The declared type and size are claims; the service checks magic bytes and counts bytes. */
public record AttachmentUpload(InputStream content, String contentType, long declaredSize) {
}
