package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.CancelDeletionUseCase;
import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.service.SingleAccountPurgeService;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.PurgeAccountsUseCase;
import com.vehiclepassport.server.account.application.port.in.RecordConsentUseCase;
import com.vehiclepassport.server.account.application.port.in.ScheduleDeletionUseCase;
import com.vehiclepassport.server.account.application.port.in.UpdateSettingsUseCase;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.account.domain.model.Settings;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.fuel.application.port.in.AddFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.testsupport.fake.FakeIdentityAdminPort;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Runs the purge against the real schema: what leaves with the user and what stays with the car. */
@QuarkusTest
@TestProfile(PersistenceProfile.class)
class AccountPurgeIT {

    static final UUID LEAVER = UUID.fromString("00000000-0000-0000-0000-00000000a001");
    static final UUID WAITER = UUID.fromString("00000000-0000-0000-0000-00000000a002");
    static final UUID RETRIER = UUID.fromString("00000000-0000-0000-0000-00000000a003");
    static final UUID CANCELLER = UUID.fromString("00000000-0000-0000-0000-00000000a006");
    static final String GHOST_SUB = "00000000-0000-0000-0000-00000000a007";
    static final UUID TOMBSTONE = new UUID(0L, 0L);

    @Inject
    EntityManager em;
    @Inject
    CancelDeletionUseCase cancelling;
    @Inject
    SingleAccountPurgeService step;
    @Inject
    GetMeUseCase me;
    @Inject
    ScheduleDeletionUseCase scheduling;
    @Inject
    PurgeAccountsUseCase purge;
    @Inject
    RecordConsentUseCase consents;
    @Inject
    UpdateSettingsUseCase settings;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AddEventUseCase adding;
    @Inject
    CreatePassportUseCase passports;
    @Inject
    FakeIdentityAdminPort identity;
    @Inject
    AddFuelEntryUseCase fuel;

    @AfterEach
    void resetIdentity() {
        identity.reset();
    }

    private static String randomVin() {
        String alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(alphabet.charAt(r.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    private static String sha256(UUID id) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(id.toString().getBytes(StandardCharsets.UTF_8)));
    }

    private long count(String sql, Object... params) {
        return QuarkusTransaction.requiringNew().call(() -> {
            var q = em.createNativeQuery(sql);
            for (int i = 0; i < params.length; i++) {
                q.setParameter(i + 1, params[i]);
            }
            return ((Number) q.getSingleResult()).longValue();
        });
    }

    private Object single(String sql, Object... params) {
        return QuarkusTransaction.requiringNew().call(() -> {
            var q = em.createNativeQuery(sql);
            for (int i = 0; i < params.length; i++) {
                q.setParameter(i + 1, params[i]);
            }
            return q.getSingleResult();
        });
    }

    @Test
    void purgeRemovesTheUserAndKeepsTheCarsHistory() throws Exception {
        String vin = randomVin();
        me.get(LEAVER, "leaver@example.com", true);
        registering.register(new RegisterVehicleCommand(LEAVER, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        adding.add(new AddEventCommand(LEAVER, vin, new EventInput("SERVICE", LocalDate.parse("2025-03-01"), 1000,
                BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        passports.create(LEAVER, vin, null);
        fuel.add(new FuelEntryCommand(LEAVER, vin, null, LocalDate.parse("2025-03-02"), 1100, FuelEntryType.DIESEL,
                new BigDecimal("40.0"), new BigDecimal("300.00"), "RON", true, false, null, null, null, null));
        consents.record(LEAVER, new ConsentChange(List.of(new ConsentAcceptance(ConsentType.TERMS, "1.0"),
                new ConsentAcceptance(ConsentType.PRIVACY, "1.0")), true, null, ConsentSource.SIGN_UP_FORM));
        settings.replace(LEAVER, Settings.defaults());
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                "insert into vehicle_passport.support_report (id, user_id, kind, message, created_at) "
                        + "values (?1, ?2, 'problem', 'something is broken here', now())")
                .setParameter(1, UUID.randomUUID()).setParameter(2, LEAVER).executeUpdate());

        Instant when = scheduling.schedule(LEAVER);
        assertTrue(purge.purgeDue(when.plusSeconds(1)) >= 1);

        assertEquals(0, count("select count(*) from vehicle_passport.user_profile where id = ?1", LEAVER));
        assertEquals(0, count("select count(*) from vehicle_passport.user_settings where user_id = ?1", LEAVER));
        assertEquals(1, count("select count(*) from vehicle_passport.vehicle where vin = ?1", vin));
        assertEquals(1, count("select count(*) from vehicle_passport.vehicle_event where vin = ?1 and created_by = ?2",
                vin, TOMBSTONE));
        assertEquals(0, count("select count(*) from vehicle_passport.vehicle_event where created_by = ?1", LEAVER));
        // Fuel entries are personal usage data: deleted outright, not handed to the tombstone.
        assertEquals(0, count("select count(*) from vehicle_passport.fuel_entry where vin = ?1", vin));
        assertEquals(1, count("select count(*) from vehicle_passport.ownership_period "
                + "where vin = ?1 and owner_id = ?2 and owned_to is not null", vin, TOMBSTONE));
        assertEquals(0, count("select count(*) from vehicle_passport.ownership_period where owner_id = ?1", LEAVER));
        assertEquals(0, count("select count(*) from vehicle_passport.passport "
                + "where vin = ?1 and revoked_at is null", vin));
        assertEquals(0, count("select count(*) from vehicle_passport.consent_record where user_id = ?1", LEAVER));
        assertEquals(3, count("select count(*) from vehicle_passport.consent_record where subject_hash = ?1",
                sha256(LEAVER)));
        assertEquals(0, count("select count(*) from vehicle_passport.support_report "
                + "where message = 'something is broken here' and user_id is not null"));
        assertEquals(1, count("select count(*) from vehicle_passport.support_report "
                + "where message = 'something is broken here'"));
        assertTrue(identity.deleted().contains(LEAVER));
    }

    @Test
    void aVehicleWithoutAnOwnerCanBeRegisteredAgain() {
        String vin = randomVin();
        UUID heir = UUID.fromString("00000000-0000-0000-0000-00000000a004");
        UUID leaver = UUID.fromString("00000000-0000-0000-0000-00000000a005");
        registering.register(new RegisterVehicleCommand(leaver, vin, "Dacia", "Logan", null, 2019, "PETROL"));
        Instant when = scheduling.schedule(leaver);
        purge.purgeDue(when.plusSeconds(1));
        var result = registering.register(new RegisterVehicleCommand(heir, vin, "Dacia", "Logan", null, 2019,
                "PETROL"));
        assertTrue(result instanceof RegisterVehicleUseCase.Registered);
        assertEquals(1, count("select count(*) from vehicle_passport.ownership_period "
                + "where vin = ?1 and owned_to is null and owner_id = ?2", vin, heir));
    }

    @Test
    void purgeIgnoresAccountsNotYetDue() {
        me.get(WAITER, null, false);
        Instant when = scheduling.schedule(WAITER);
        purge.purgeDue(when.minusSeconds(1));
        assertEquals(1, count("select count(*) from vehicle_passport.user_profile where id = ?1", WAITER));
        assertFalse(identity.deleted().contains(WAITER));
    }

    @Test
    void aCancelledDeletionIsNotPurgedFromAStaleDueList() {
        me.get(CANCELLER, "canceller@example.com", true);
        scheduling.schedule(CANCELLER);
        // The job's due list was read while the deletion was still scheduled; the user cancels before their turn.
        cancelling.cancel(CANCELLER);

        assertFalse(step.purge(CANCELLER, Instant.now().plus(java.time.Duration.ofDays(400))));

        assertEquals(1, count("select count(*) from vehicle_passport.user_profile where id = ?1", CANCELLER));
        assertFalse(identity.deleted().contains(CANCELLER));
    }

    @Test
    @TestSecurity(user = "a007")
    @OidcSecurity(claims = {@Claim(key = "sub", value = GHOST_SUB), @Claim(key = "email", value = "ghost@example.com")})
    void anErasedSubjectIsRefusedAndNoProfileIsRecreated() {
        UUID ghost = UUID.fromString(GHOST_SUB);
        me.get(ghost, "ghost@example.com", true);
        Instant when = scheduling.schedule(ghost);
        assertTrue(purge.purgeDue(when.plusSeconds(1)) >= 1);

        // The access token outlives the account by up to an hour.
        given().when().get("/me").then().statusCode(401).body(equalTo(""));
        given().contentType("application/json").body("{\"displayName\":\"Back again\"}")
                .when().patch("/me").then().statusCode(401);
        given().when().post("/me/deletion").then().statusCode(401);

        assertEquals(0, count("select count(*) from vehicle_passport.user_profile where id = ?1", ghost));
    }

    @Test
    void purgeReleasesTheCarLikeASaleWouldPlateRemovedAndPendingClaimsRejected() {
        String vin = randomVin();
        UUID leaver = UUID.fromString("00000000-0000-0000-0000-00000000a008");
        UUID claimant = UUID.fromString("00000000-0000-0000-0000-00000000a009");
        registering.register(new RegisterVehicleCommand(leaver, vin, "Dacia", "Logan", null, 2019, "PETROL"));
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                "update vehicle_passport.vehicle set plate = 'B123ABC' where vin = ?1")
                .setParameter(1, vin).executeUpdate());
        var filed = registering.register(new RegisterVehicleCommand(claimant, vin, "Dacia", "Logan", null, 2019,
                "PETROL"));
        assertTrue(filed instanceof RegisterVehicleUseCase.ClaimFiled);
        UUID claimId = ((RegisterVehicleUseCase.ClaimFiled) filed).claimId();

        Instant when = scheduling.schedule(leaver);
        assertTrue(purge.purgeDue(when.plusSeconds(1)) >= 1);

        assertEquals(1, count("select count(*) from vehicle_passport.vehicle where vin = ?1 and plate is null", vin));
        assertEquals("REJECTED", single("select status from vehicle_passport.ownership_claim where id = ?1", claimId));
        assertEquals(1, count("select count(*) from vehicle_passport.ownership_claim "
                + "where id = ?1 and decided_at is not null", claimId));
        var registered = registering.register(new RegisterVehicleCommand(claimant, vin, "Dacia", "Logan", null, 2019,
                "PETROL"));
        assertTrue(registered instanceof RegisterVehicleUseCase.Registered);
        assertEquals(null, ((RegisterVehicleUseCase.Registered) registered).vehicle().plate());
    }

    @Test
    void purgeFinishesOnRerunAfterIdentityDeleteFailure() {
        me.get(RETRIER, null, false);
        Instant when = scheduling.schedule(RETRIER);
        identity.failWith(new IllegalStateException("supabase down"));

        assertEquals(0, purge.purgeDue(when.plusSeconds(1)));
        assertEquals(1, count("select count(*) from vehicle_passport.user_profile where id = ?1", RETRIER));
        assertNotNull(single("select deletion_scheduled_for from vehicle_passport.user_profile where id = ?1", RETRIER));

        identity.recover();
        // Other tests may have left accounts due as well, so count at least this one.
        assertTrue(purge.purgeDue(when.plusSeconds(1)) >= 1);
        assertEquals(0, count("select count(*) from vehicle_passport.user_profile where id = ?1", RETRIER));
        assertTrue(identity.deleted().contains(RETRIER));
        assertEquals(0, purge.purgeDue(when.plusSeconds(1)), "a finished purge is not repeated");
    }
}
