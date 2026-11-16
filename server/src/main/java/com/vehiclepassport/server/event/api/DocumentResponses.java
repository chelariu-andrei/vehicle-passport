package com.vehiclepassport.server.event.api;

import com.vehiclepassport.server.event.application.port.in.EventDocument;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.InputStream;

/** Streams a stored file to the client and closes it afterwards. */
final class DocumentResponses {

    private DocumentResponses() {
    }

    static Response stream(EventDocument document) {
        StreamingOutput body = out -> {
            try (InputStream in = document.content()) {
                in.transferTo(out);
            }
        };
        return Response.ok(body, document.contentType()).build();
    }
}
