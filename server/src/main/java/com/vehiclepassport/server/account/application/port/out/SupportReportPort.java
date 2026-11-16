package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.SupportReport;
import java.time.Instant;
import java.util.UUID;

public interface SupportReportPort {

    void save(UUID id, UUID userId, SupportReport report, Instant createdAt);
}
