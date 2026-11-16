package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.out.AccountErasurePort;
import com.vehiclepassport.server.account.application.port.out.ErasedAccountPort;
import com.vehiclepassport.server.account.application.port.out.IdentityAdminPort;
import com.vehiclepassport.server.account.application.port.out.OwnerDataEraserPort;
import com.vehiclepassport.server.account.application.service.AccountPurgeService;
import com.vehiclepassport.server.account.application.service.SingleAccountPurgeService;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccountPurgeServiceTest {

    private static final UUID DUE = UUID.fromString("00000000-0000-0000-0000-0000000000b1");
    private static final UUID LATER = UUID.fromString("00000000-0000-0000-0000-0000000000b2");
    private static final UUID OTHER_DUE = UUID.fromString("00000000-0000-0000-0000-0000000000b3");
    private static final Instant NOW = Instant.parse("2026-12-20T03:00:00Z");

    private final Map<UUID, Instant> scheduled = new LinkedHashMap<>(
            Map.of(DUE, NOW.minusSeconds(1), LATER, NOW.plusSeconds(1)));
    private final List<String> calls = new ArrayList<>();
    private boolean identityDown;
    private boolean cancelledAfterSnapshot;

    private final AccountErasurePort erasure = new AccountErasurePort() {
        public List<UUID> findDue(Instant now) {
            return scheduled.entrySet().stream().filter(e -> !e.getValue().isAfter(now)).map(Map.Entry::getKey)
                    .toList();
        }

        public boolean lockIfDue(UUID userId, Instant now) {
            Instant when = cancelledAfterSnapshot ? null : scheduled.get(userId);
            return when != null && !when.isAfter(now);
        }

        public void anonymiseConsents(UUID userId, String subjectHash) {
            calls.add("consents:" + userId + ":" + subjectHash);
        }

        public void detachSupportReports(UUID userId) { calls.add("support:" + userId); }

        public void deleteSettings(UUID userId) { calls.add("settings:" + userId); }

        public void deleteProfile(UUID userId) {
            calls.add("profile:" + userId);
            scheduled.remove(userId);
        }
    };

    private final OwnerDataEraserPort data = new OwnerDataEraserPort() {
        public void revokePassports(UUID ownerId) { calls.add("passports:" + ownerId); }

        public void detachOwnedData(UUID ownerId, UUID tombstone) { calls.add("detach:" + ownerId + ":" + tombstone); }
    };

    private final IdentityAdminPort identity = userId -> {
        if (identityDown) {
            throw new IllegalStateException("supabase unavailable");
        }
        calls.add("identity:" + userId);
    };

    private final ErasedAccountPort erased = new ErasedAccountPort() {
        public void markErased(UUID userId, Instant at) { calls.add("erased:" + userId); }

        public boolean isErased(UUID userId) { return false; }
    };

    private final AccountPurgeService service =
            new AccountPurgeService(new SingleAccountPurgeService(data, erasure, identity, erased));

    private static String sha256(UUID id) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(id.toString().getBytes("UTF-8")));
    }

    @Test
    void purgeIgnoresNotYetDue() {
        scheduled.remove(DUE);
        assertEquals(0, service.purgeDue(NOW));
        assertTrue(calls.isEmpty());
        assertTrue(scheduled.containsKey(LATER));
    }

    @Test
    void purgeRemovesEverythingInOrderAndDeletesTheProfileLast() {
        assertEquals(1, service.purgeDue(NOW));
        assertEquals(List.of(
                "passports:" + DUE,
                "detach:" + DUE + ":" + SingleAccountPurgeService.TOMBSTONE,
                "consents:" + DUE + ":" + DUE_HASH(),
                "support:" + DUE,
                "settings:" + DUE,
                "identity:" + DUE,
                "erased:" + DUE,
                "profile:" + DUE), calls);
        assertTrue(scheduled.containsKey(LATER));
    }

    @Test
    void aDeletionCancelledAfterTheDueListWasReadIsNotPurged() {
        // findDue still lists DUE, but the locked re-check sees the cancelled schedule.
        cancelledAfterSnapshot = true;
        assertEquals(0, service.purgeDue(NOW));
        assertTrue(calls.isEmpty(), "nothing may be erased: " + calls);
        assertTrue(scheduled.containsKey(DUE));
    }

    @Test
    void purgeAnonymisesConsentHistoryWithTheSha256OfTheUserId() throws Exception {
        service.purgeDue(NOW);
        assertTrue(calls.contains("consents:" + DUE + ":" + sha256(DUE)));
    }

    @Test
    void purgeRevokesActivePassportsAndDetachesOwnedDataToTheTombstone() {
        service.purgeDue(NOW);
        assertTrue(calls.contains("passports:" + DUE));
        assertTrue(calls.contains("detach:" + DUE + ":" + SingleAccountPurgeService.TOMBSTONE));
        assertEquals(new UUID(0, 0), SingleAccountPurgeService.TOMBSTONE);
    }

    @Test
    void purgeIsIdempotentAfterIdentityDeleteFailure() {
        identityDown = true;
        assertEquals(0, service.purgeDue(NOW));
        assertTrue(scheduled.containsKey(DUE), "profile must survive so the retry still finds the job");
        assertTrue(calls.stream().noneMatch(c -> c.startsWith("profile:")));

        identityDown = false;
        calls.clear();
        assertEquals(1, service.purgeDue(NOW));
        assertTrue(calls.contains("identity:" + DUE));
        assertTrue(calls.contains("profile:" + DUE));
        assertTrue(scheduled.isEmpty() || !scheduled.containsKey(DUE));
    }

    @Test
    void oneFailingAccountDoesNotBlockTheOthers() {
        scheduled.put(OTHER_DUE, NOW.minusSeconds(5));
        OwnerDataEraserPort flaky = new OwnerDataEraserPort() {
            public void revokePassports(UUID ownerId) {
                if (ownerId.equals(DUE)) {
                    throw new IllegalStateException("boom");
                }
                calls.add("passports:" + ownerId);
            }

            public void detachOwnedData(UUID ownerId, UUID tombstone) { }
        };
        AccountPurgeService s = new AccountPurgeService(new SingleAccountPurgeService(flaky, erasure, identity, erased));
        assertEquals(1, s.purgeDue(NOW));
        assertTrue(scheduled.containsKey(DUE));
        assertTrue(!scheduled.containsKey(OTHER_DUE));
    }

    private static String DUE_HASH() {
        try {
            return sha256(DUE);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
