package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.passport.application.port.out.QrCodePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.nio.charset.StandardCharsets;

/** Deterministic stand-in: the "PNG" is the encoded text, so tests can see what the QR carries. */
@Alternative
@ApplicationScoped
public class FakeQrCode implements QrCodePort {

    @Override
    public byte[] png(String text) {
        return ("QR|" + text).getBytes(StandardCharsets.UTF_8);
    }
}
