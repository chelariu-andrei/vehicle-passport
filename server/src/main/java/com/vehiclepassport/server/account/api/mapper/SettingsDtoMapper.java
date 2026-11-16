package com.vehiclepassport.server.account.api.mapper;

import com.vehiclepassport.server.account.api.dto.SettingsDto;
import com.vehiclepassport.server.account.domain.model.Appearance;
import com.vehiclepassport.server.account.domain.model.Currency;
import com.vehiclepassport.server.account.domain.model.DistanceUnit;
import com.vehiclepassport.server.account.domain.model.Language;
import com.vehiclepassport.server.account.domain.model.NotificationPrefs;
import com.vehiclepassport.server.account.domain.model.Settings;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SettingsDtoMapper {

    public Settings toDomain(SettingsDto d) {
        SettingsDto.Notifications n = d.notifications();
        return new Settings(Language.fromValue(d.language()), Appearance.fromValue(d.appearance()),
                DistanceUnit.fromValue(d.units().distance()), Currency.fromValue(d.units().currency()),
                new NotificationPrefs(n.documentDeadlines(), n.reminderDays(), n.activityScans(),
                        n.activityPassportViews(), n.activityTransfers(), n.productNews()));
    }

    public SettingsDto toDto(Settings s) {
        NotificationPrefs n = s.notifications();
        return new SettingsDto(s.language().value(), s.appearance().value(),
                new SettingsDto.Units(s.distance().value(), s.currency().value()),
                new SettingsDto.Notifications(n.documentDeadlines(), n.reminderDays(), n.activityScans(),
                        n.activityPassportViews(), n.activityTransfers(), n.productNews()));
    }
}
