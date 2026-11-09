package com.vehiclepassport.server.passport.application.port.in;

import java.util.List;
import java.util.UUID;

public interface ListMyPassportsUseCase {

    List<PassportView> list(UUID userId);
}
