package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.SubmittedSupportReport;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SupportReportPort {

    void save(UUID id, UUID userId, SupportReport report, Instant createdAt);

    /** The user's reports, oldest first. */
    List<SubmittedSupportReport> findByUser(UUID userId);
}
