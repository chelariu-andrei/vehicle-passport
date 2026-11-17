package com.vehiclepassport.server.account.domain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.NotificationPrefs;
import com.vehiclepassport.server.account.domain.model.Settings;
import java.util.List;
import org.junit.jupiter.api.Test;

class SettingsTest {

    @Test
    void reminderDaysRejectUnknownValue() {
        assertThrows(ValidationFailedException.class, () -> new NotificationPrefs(true, List.of(30, 14), true, true, true, true, false));
    }

    @Test
    void tireSeasonDefaultsOn() {
        assertTrue(NotificationPrefs.defaults().tireSeason());
        assertTrue(Settings.defaults().notifications().tireSeason());
    }

    @Test
    void productNewsDefaultsOff() {
        assertFalse(Settings.defaults().notifications().productNews());
    }
}
