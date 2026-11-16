package com.vehiclepassport.server.account.api.mapper;

import com.vehiclepassport.server.account.api.dto.AccountExportResponse;
import com.vehiclepassport.server.account.application.port.in.AccountExport;
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
                e.data().passports());
    }
}
