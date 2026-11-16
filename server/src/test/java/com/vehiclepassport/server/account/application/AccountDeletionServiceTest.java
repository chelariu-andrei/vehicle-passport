package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.application.service.AccountDeletionService;
import com.vehiclepassport.server.account.application.service.AccountProfileService;
import com.vehiclepassport.server.account.domain.exception.DeletionAlreadyScheduledException;
import com.vehiclepassport.server.account.domain.exception.DeletionNotScheduledException;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.OwnerStats;
import com.vehiclepassport.server.account.domain.model.Profile;
import com.vehiclepassport.server.shared.config.AccountConfig;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccountDeletionServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");

    private final Map<UUID, Profile> rows = new HashMap<>();

    private final ProfilePort profiles = new ProfilePort() {
        public Profile upsertIfAbsent(Profile p) { return rows.computeIfAbsent(p.id(), id -> p); }

        public Optional<Profile> findById(UUID id) { return Optional.ofNullable(rows.get(id)); }

        public void save(Profile p) { rows.put(p.id(), p); }
    };

    private final Clock clock = new Clock() {
        public ZoneId getZone() { return ZoneOffset.UTC; }

        public Clock withZone(ZoneId zone) { return this; }

        public Instant instant() { return NOW; }
    };

    private final AccountConfig config = new AccountConfig() {
        public Consent consent() { return () -> true; }

        public Deletion deletion() { return () -> 30; }

        public Purge purge() { return () -> "0 0 3 * * ?"; }
    };

    private final AccountDeletionService service = new AccountDeletionService(profiles, clock, config);

    @Test
    void scheduleSetsDateThirtyDaysAhead() {
        Instant when = service.schedule(USER);
        assertEquals(NOW.plus(Duration.ofDays(30)), when);
        assertEquals(when, rows.get(USER).deletionScheduledFor());
    }

    @Test
    void scheduleTwiceIs409AndKeepsTheFirstDate() {
        Instant first = service.schedule(USER);
        assertThrows(DeletionAlreadyScheduledException.class, () -> service.schedule(USER));
        assertEquals(first, rows.get(USER).deletionScheduledFor());
    }

    @Test
    void cancelClearsSchedule() {
        service.schedule(USER);
        service.cancel(USER);
        assertNull(rows.get(USER).deletionScheduledFor());
        service.schedule(USER);
        assertNotNull(rows.get(USER).deletionScheduledFor());
    }

    @Test
    void cancelWithoutScheduleIs404() {
        assertThrows(DeletionNotScheduledException.class, () -> service.cancel(USER));
        service.schedule(USER);
        service.cancel(USER);
        assertThrows(DeletionNotScheduledException.class, () -> service.cancel(USER));
    }

    @Test
    void schedulingKeepsProfileFields() {
        rows.put(USER, new Profile(USER, "a@b.c", null, null, NOW.minusSeconds(60), null));
        service.schedule(USER);
        assertEquals("a@b.c", rows.get(USER).email());
        assertEquals(NOW.minusSeconds(60), rows.get(USER).createdAt());
    }

    @Test
    void signedInUserWithScheduleStillGetsMe() {
        Instant when = service.schedule(USER);
        AccountProfileService me = new AccountProfileService(profiles, id -> new OwnerStats(0, 0, 0),
                id -> ConsentStatus.of("1.0", "1.0", "1.0", "1.0", false, false), clock);
        Me result = me.get(USER, "a@b.c", true);
        assertEquals(when, result.profile().deletionScheduledFor());
        assertEquals(when, rows.get(USER).deletionScheduledFor());
    }
}
