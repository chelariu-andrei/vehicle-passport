package com.vehiclepassport.server.account.api.mapper;

import com.vehiclepassport.server.account.api.dto.AccountExportResponse;
import com.vehiclepassport.server.account.api.dto.SupportReportExportDto;
import com.vehiclepassport.server.account.api.dto.SupportReportRequest;
import com.vehiclepassport.server.account.application.port.in.AccountExport;
import com.vehiclepassport.server.account.domain.model.SubmittedSupportReport;
import com.vehiclepassport.server.account.domain.model.SupportDiagnostics;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class ExportDtoMapper {

    @Inject
    MeDtoMapper me;
    @Inject
    SettingsDtoMapper settings;
    @Inject
    ConsentDtoMapper consents;

    public AccountExportResponse toResponse(AccountExport e) {
        return new AccountExportResponse(e.exportedAt(), me.toResponse(e.profile()), settings.toDto(e.settings()),
                e.consents().stream().map(consents::toDto).toList(), e.data().vehicles(), e.data().events(),
                e.data().passports(), e.supportReports().stream().map(ExportDtoMapper::toDto).toList());
    }

    private static SupportReportExportDto toDto(SubmittedSupportReport r) {
        return new SupportReportExportDto(r.kind().value(), r.message(), toDto(r.diagnostics()), r.createdAt());
    }

    private static SupportReportRequest.Diagnostics toDto(SupportDiagnostics d) {
        return d == null ? null
                : new SupportReportRequest.Diagnostics(d.appVersion(), d.platform(), d.osVersion(), d.deviceModel());
    }
}
