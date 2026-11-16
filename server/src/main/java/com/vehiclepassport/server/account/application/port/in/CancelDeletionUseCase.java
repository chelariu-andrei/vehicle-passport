package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface CancelDeletionUseCase {

    void cancel(UUID userId);
}
