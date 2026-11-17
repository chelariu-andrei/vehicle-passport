package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.AccountExport;
import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.out.OwnerDataExportPort;
import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.model.SubmittedSupportReport;
import com.vehiclepassport.server.account.domain.model.SupportKind;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import com.vehiclepassport.server.account.application.service.AccountExportService;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.account.domain.model.OwnedData;
import com.vehiclepassport.server.account.domain.model.OwnerStats;
import com.vehiclepassport.server.account.domain.model.Profile;
import com.vehiclepassport.server.account.domain.model.Settings;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccountExportServiceTest {

    private static final UUID ME = UUID.fromString("00000000-0000-0000-0000-0000000000d1");
    private static final UUID OTHER = UUID.fromString("00000000-0000-0000-0000-0000000000d2");
    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");

    private final List<ConsentRecord> consents = new ArrayList<>();
    private final Map<UUID, List<Map<String, Object>>> vehicles = new java.util.HashMap<>();
    private UUID askedForData;

    private final Clock clock = new Clock() {
        public ZoneId getZone() { return ZoneOffset.UTC; }

        public Clock withZone(ZoneId zone) { return this; }

        public Instant instant() { return NOW; }
    };

    private final OwnerDataExportPort data = owner -> {
        askedForData = owner;
        return new OwnedData(vehicles.getOrDefault(owner, List.of()), List.of(), List.of(), List.of());
    };

    private final AccountExportService service = new AccountExportService(
            (user, email, verified) -> new Me(new Profile(user, email, null, null, NOW, null), verified,
                    new OwnerStats(0, 0, 0), ConsentStatus.of("1.0", "1.0", null, null, false, false)),
            user -> Settings.defaults(),
            user -> consents.stream().filter(c -> user.equals(c.userId())).toList(),
            data, new SupportReportPort() {
                public void save(UUID id, UUID userId, SupportReport report, Instant createdAt) { }

                public List<SubmittedSupportReport> findByUser(UUID userId) {
                    return ME.equals(userId) ? List.of(new SubmittedSupportReport(SupportKind.QUESTION,
                            "how do I export my data?", null, NOW)) : List.of();
                }
            }, clock);

    private static ConsentRecord consent(UUID user) {
        return new ConsentRecord(UUID.randomUUID(), user, null, ConsentType.TERMS, "1.0", true,
                ConsentSource.SIGN_UP_FORM, NOW);
    }

    @Test
    void exportContainsOnlyCallersData() {
        vehicles.put(ME, List.of(Map.of("vin", "MINE")));
        vehicles.put(OTHER, List.of(Map.of("vin", "THEIRS")));
        AccountExport export = service.export(ME, "me@example.com", true);
        assertEquals(ME, askedForData);
        assertEquals(ME, export.profile().profile().id());
        assertEquals(List.of(Map.of("vin", "MINE")), export.data().vehicles());
        assertEquals(NOW, export.exportedAt());
        assertEquals(Settings.defaults(), export.settings());
    }

    @Test
    void exportContainsTheCallersSupportReports() {
        assertEquals(List.of(new SubmittedSupportReport(SupportKind.QUESTION, "how do I export my data?", null, NOW)),
                service.export(ME, null, false).supportReports());
        assertTrue(service.export(OTHER, null, false).supportReports().isEmpty());
    }

    @Test
    void exportWorksForUserWithNoVehicles() {
        AccountExport export = service.export(ME, null, false);
        assertTrue(export.data().vehicles().isEmpty());
        assertTrue(export.data().events().isEmpty());
        assertTrue(export.data().passports().isEmpty());
        assertTrue(export.consents().isEmpty());
    }

    @Test
    void exportExcludesOtherUsersConsents() {
        consents.add(consent(ME));
        consents.add(consent(OTHER));
        consents.add(consent(OTHER));
        AccountExport export = service.export(ME, null, false);
        assertEquals(1, export.consents().size());
        assertEquals(ME, export.consents().get(0).userId());
    }
}
