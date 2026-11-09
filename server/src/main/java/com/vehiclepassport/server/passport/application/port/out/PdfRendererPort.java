package com.vehiclepassport.server.passport.application.port.out;

public interface PdfRendererPort {

    byte[] render(PassportDocument document);
}
