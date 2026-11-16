package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.in.ProfileChange;
import com.vehiclepassport.server.account.application.port.out.ConsentStatusReaderPort;
import com.vehiclepassport.server.account.application.port.out.OwnerStatsPort;
import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.application.service.AccountProfileService;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.OwnerStats;
import com.vehiclepassport.server.account.domain.model.Profile;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccountProfileServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-0000000000a1");

    private final Map<UUID, Profile> rows = new HashMap<>();
    private int inserts;

    private final ProfilePort profiles = new ProfilePort() {
        @Override
        public Profile upsertIfAbsent(Profile profile) {
            if (!rows.containsKey(profile.id())) {
                rows.put(profile.id(), profile);
                inserts++;
            }
            return rows.get(profile.id());
        }

        @Override
        public Optional<Profile> findById(UUID id) {
            return Optional.ofNullable(rows.get(id));
        }

        @Override
        public Optional<Profile> findByIdForUpdate(UUID id) {
            return findById(id);
        }

        @Override
        public void save(Profile profile) {
            rows.put(profile.id(), profile);
        }
    };

    private final OwnerStatsPort stats = ownerId -> new OwnerStats(2, 3, 1);
    private final ConsentStatusReaderPort consent = userId -> ConsentStatus.of("1.0", "1.0", null, null, false, false);
    private final Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
    private final AccountProfileService service = new AccountProfileService(profiles, stats, consent, clock);

    @Test
    void firstMeCallCreatesProfile() {
        Me me = service.get(USER, "a@b.ro", true);
        assertEquals(1, inserts);
        assertEquals(USER, me.profile().id());
        assertEquals("a@b.ro", me.profile().email());
        assertTrue(me.emailVerified());
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), me.profile().createdAt());
        assertEquals(3, me.stats().events());
        assertTrue(me.consent().required());
    }

    @Test
    void secondCallReturnsSameRow() {
        Me first = service.get(USER, "a@b.ro", true);
        Me second = service.get(USER, "a@b.ro", true);
        assertEquals(1, inserts);
        assertEquals(first.profile(), second.profile());
    }

    @Test
    void meWorksWithoutEmailClaim() {
        Me me = service.get(USER, null, false);
        assertNull(me.profile().email());
    }

    @Test
    void nullClaimDoesNotOverwriteStoredEmail() {
        service.get(USER, "a@b.ro", true);
        assertEquals("a@b.ro", service.get(USER, null, false).profile().email());
    }

    @Test
    void emailIsRefreshedWhenClaimDiffers() {
        service.get(USER, "a@b.ro", true);
        assertEquals("c@d.ro", service.get(USER, "c@d.ro", true).profile().email());
        assertEquals("c@d.ro", rows.get(USER).email());
    }

    @Test
    void patchSetsDisplayName() {
        Me me = service.update(USER, new ProfileChange(Optional.of("  Ana Pop "), Optional.empty()));
        assertEquals("Ana Pop", me.profile().displayName().value());
    }

    @Test
    void patchLeavesAbsentFieldsUnchanged() {
        service.update(USER, new ProfileChange(Optional.of("Ana"), Optional.of("+40712345678")));
        Me me = service.update(USER, new ProfileChange(Optional.empty(), Optional.empty()));
        assertEquals("Ana", me.profile().displayName().value());
        assertEquals("+40712345678", me.profile().phone().value());
    }

    @Test
    void patchClearsPhoneWithNull() {
        service.update(USER, new ProfileChange(Optional.empty(), Optional.of("+40712345678")));
        Me me = service.update(USER, new ProfileChange(Optional.empty(), Optional.of("")));
        assertNull(me.profile().phone());
    }

    @Test
    void patchRejectsPhoneWithSpaces() {
        assertThrows(ValidationFailedException.class,
                () -> service.update(USER, new ProfileChange(Optional.empty(), Optional.of("+40 712 345 678"))));
    }

    @Test
    void patchRejectsNameOver80() {
        assertThrows(ValidationFailedException.class,
                () -> service.update(USER, new ProfileChange(Optional.of("x".repeat(81)), Optional.empty())));
    }
}
