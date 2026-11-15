package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.GetSettingsUseCase;
import com.vehiclepassport.server.account.application.port.in.UpdateSettingsUseCase;
import com.vehiclepassport.server.account.application.port.out.SettingsPort;
import com.vehiclepassport.server.account.domain.model.Settings;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

@ApplicationScoped
public class SettingsService implements GetSettingsUseCase, UpdateSettingsUseCase {

    private final SettingsPort settings;

    @Inject
    public SettingsService(SettingsPort settings) {
        this.settings = settings;
    }

    @Override
    @Transactional
    public Settings get(UUID userId) {
        return settings.find(userId).orElseGet(Settings::defaults);
    }

    @Override
    @Transactional
    public Settings replace(UUID userId, Settings replacement) {
        settings.upsert(userId, replacement);
        return replacement;
    }
}
