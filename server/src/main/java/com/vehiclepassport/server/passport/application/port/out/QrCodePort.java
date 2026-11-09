package com.vehiclepassport.server.passport.application.port.out;

public interface QrCodePort {

    byte[] png(String text);
}
