package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.account.application.port.out.SettingsPort;
import com.vehiclepassport.server.account.application.service.SettingsService;
import com.vehiclepassport.server.account.domain.model.Appearance;
import com.vehiclepassport.server.account.domain.model.Currency;
import com.vehiclepassport.server.account.domain.model.DistanceUnit;
import com.vehiclepassport.server.account.domain.model.Language;
import com.vehiclepassport.server.account.domain.model.NotificationPrefs;
import com.vehiclepassport.server.account.domain.model.Settings;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SettingsServiceTest {

    private static final UUID A = UUID.fromString("00000000-0000-0000-0000-0000000000b1");
    private static final UUID B = UUID.fromString("00000000-0000-0000-0000-0000000000b2");

    private final Map<UUID, Settings> rows = new HashMap<>();
    private int writes;

    private final SettingsPort port = new SettingsPort() {
        @Override
        public Optional<Settings> find(UUID userId) {
            return Optional.ofNullable(rows.get(userId));
        }

        @Override
        public void upsert(UUID userId, Settings settings) {
            writes++;
            rows.put(userId, settings);
        }
    };

    private final SettingsService service = new SettingsService(port);

    private static Settings custom() {
        return new Settings(Language.RO, Appearance.DARK, DistanceUnit.MI, Currency.EUR,
                new NotificationPrefs(false, List.of(7), false, false, true, false, true));
    }

    @Test
    void getReturnsDefaultsForNewUserWithoutWriting() {
        assertEquals(Settings.defaults(), service.get(A));
        assertEquals(0, writes);
    }

    @Test
    void replacePersistsAndGetReturnsSame() {
        assertEquals(custom(), service.replace(A, custom()));
        assertEquals(custom(), service.get(A));
    }

    @Test
    void settingsAreIsolatedPerUser() {
        service.replace(A, custom());
        assertEquals(Settings.defaults(), service.get(B));
    }
}
