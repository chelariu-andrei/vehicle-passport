package com.vehiclepassport.server.event.application.port.in;

import java.io.InputStream;

/** The original file of a documented event; the caller must close the stream. */
public record EventDocument(InputStream content, String contentType) {
}
