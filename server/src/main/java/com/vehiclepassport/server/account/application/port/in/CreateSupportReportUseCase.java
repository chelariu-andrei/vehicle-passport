package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.SupportReport;
import java.util.UUID;

public interface CreateSupportReportUseCase {

    /** Validates and stores the report; returns its id. Diagnostics are stored only when the user opted in. */
    UUID create(UUID userId, SupportReport report);
}
