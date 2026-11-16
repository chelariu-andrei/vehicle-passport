package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.AccountExport;
import com.vehiclepassport.server.account.application.port.in.ExportMyDataUseCase;
import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.GetSettingsUseCase;
import com.vehiclepassport.server.account.application.port.in.ListConsentHistoryUseCase;
import com.vehiclepassport.server.account.application.port.out.OwnerDataExportPort;
import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.UUID;

@ApplicationScoped
public class AccountExportService implements ExportMyDataUseCase {

    private final GetMeUseCase me;
    private final GetSettingsUseCase settings;
    private final ListConsentHistoryUseCase consents;
    private final OwnerDataExportPort data;
    private final SupportReportPort supportReports;
    private final Clock clock;

    @Inject
    public AccountExportService(GetMeUseCase me, GetSettingsUseCase settings, ListConsentHistoryUseCase consents,
            OwnerDataExportPort data, SupportReportPort supportReports, Clock clock) {
        this.me = me;
        this.settings = settings;
        this.consents = consents;
        this.data = data;
        this.supportReports = supportReports;
        this.clock = clock;
    }

    @Override
    @Transactional
    public AccountExport export(UUID userId, String emailClaim, boolean emailVerified) {
        return new AccountExport(clock.instant(), me.get(userId, emailClaim, emailVerified), settings.get(userId),
                consents.history(userId), data.exportFor(userId), supportReports.findByUser(userId));
    }
}
