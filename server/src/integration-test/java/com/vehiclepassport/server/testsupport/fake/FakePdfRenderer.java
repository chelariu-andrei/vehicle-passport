package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.passport.application.port.out.PassportDocument;
import com.vehiclepassport.server.passport.application.port.out.PdfRendererPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.nio.charset.StandardCharsets;

/** Deterministic stand-in: the "PDF" is a text carrying the hash, the URL and the event count. */
@Alternative
@ApplicationScoped
public class FakePdfRenderer implements PdfRendererPort {

    @Override
    public byte[] render(PassportDocument d) {
        String text = "PDF|" + d.hash() + "|" + d.publicUrl() + "|events=" + d.events().size()
                + "|qr=" + d.qrPng().length;
        return text.getBytes(StandardCharsets.UTF_8);
    }
}
