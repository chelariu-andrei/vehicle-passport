package com.vehiclepassport.server.scan.application.port.out;

import java.util.UUID;

public interface EventSavePort {

    UUID saveDocumented(ConfirmedEvent event);
}
