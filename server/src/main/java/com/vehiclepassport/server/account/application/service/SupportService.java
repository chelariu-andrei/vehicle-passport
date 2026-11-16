package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.CreateSupportReportUseCase;
import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.UUID;

@ApplicationScoped
public class SupportService implements CreateSupportReportUseCase {

    static final int MIN_MESSAGE = 10;
    static final int MAX_MESSAGE = 4000;

    private final SupportReportPort reports;
    private final Clock clock;

    @Inject
    public SupportService(SupportReportPort reports, Clock clock) {
        this.reports = reports;
        this.clock = clock;
    }

    @Override
    @Transactional
    public UUID create(UUID userId, SupportReport report) {
        String message = report.message() == null ? "" : report.message().strip();
        if (message.length() < MIN_MESSAGE || message.length() > MAX_MESSAGE) {
            throw new ValidationFailedException("message must be " + MIN_MESSAGE + " to " + MAX_MESSAGE
                    + " characters");
        }
        SupportReport clean = new SupportReport(report.kind(), message, report.includeDiagnostics(),
                report.includeDiagnostics() ? report.diagnostics() : null);
        UUID id = UUID.randomUUID();
        reports.save(id, userId, clean, clock.instant());
        return id;
    }
}
