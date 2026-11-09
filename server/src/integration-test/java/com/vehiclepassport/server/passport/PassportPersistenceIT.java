package com.vehiclepassport.server.passport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.passport.application.port.out.PassportRepositoryPort;
import com.vehiclepassport.server.passport.domain.model.Passport;
import com.vehiclepassport.server.passport.domain.model.PublicLink;
import com.vehiclepassport.server.passport.domain.model.Snapshot;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class PassportPersistenceIT {

    private static final Instant T0 = Instant.parse("2025-06-01T10:00:00Z");

    @Inject
    PassportRepositoryPort passports;
    @Inject
    RegisterVehicleUseCase registering;

    private String vin() {
        String vin = PassportFixtures.randomVin();
        registering.register(new RegisterVehicleCommand(UUID.randomUUID(), vin, "Dacia", "Duster", null, 2020,
                "DIESEL"));
        return vin;
    }

    private static Passport passport(String vin, Snapshot snapshot, String token) {
        return new Passport(UUID.randomUUID(), vin, UUID.randomUUID(), T0, snapshot,
                new PublicLink(token, T0.plusSeconds(3600), null), "passports/x.pdf");
    }

    private static Snapshot trickySnapshot(String vin) {
        SnapshotEvent event = new SnapshotEvent(UUID.randomUUID(), "SERVICE", LocalDate.parse("2025-03-01"), 1000,
                new BigDecimal("10.50"), "RON", PassportFixtures.TRICKY_NOTES, null, null, null, "USER_CONFIRMED",
                false);
        return Snapshot.of(new SnapshotVehicle(vin, "Dacia", "Duster", null, 2020, "DIESEL"), List.of(event));
    }

    @Test
    void snapshot_text_round_trips_byte_identical() {
        String vin = vin();
        // Key order and spacing that jsonb would rewrite; the column must keep it as is.
        Snapshot odd = new Snapshot("{\"z\": 1,  \"a\" :[1, 2],\"s\":\"\\u00e9 😀\"}", "0".repeat(64));
        Passport oddPassport = passport(vin, odd, "tok-" + UUID.randomUUID());
        Snapshot real = trickySnapshot(vin);
        Passport realPassport = passport(vin, real, "tok-" + UUID.randomUUID());
        QuarkusTransaction.requiringNew().run(() -> {
            passports.save(oddPassport);
            passports.save(realPassport);
        });

        Passport loadedOdd = QuarkusTransaction.requiringNew().call(() -> passports.findById(oddPassport.id()))
                .orElseThrow();
        Passport loadedReal = QuarkusTransaction.requiringNew().call(() -> passports.findById(realPassport.id()))
                .orElseThrow();

        assertEquals(odd.canonicalJson(), loadedOdd.snapshot().canonicalJson());
        assertEquals(real, loadedReal.snapshot());
        assertEquals(oddPassport, loadedOdd);
        assertEquals(realPassport, loadedReal);
        assertTrue(loadedReal.snapshot().canonicalJson().contains("ă â î ș ț"));
    }

    @Test
    void findByToken() {
        String vin = vin();
        String token = "tok-" + UUID.randomUUID();
        Passport p = passport(vin, trickySnapshot(vin), token);
        QuarkusTransaction.requiringNew().run(() -> passports.save(p));

        assertEquals(p, QuarkusTransaction.requiringNew().call(() -> passports.findByToken(token)).orElseThrow());
        assertTrue(QuarkusTransaction.requiringNew().call(() -> passports.findByToken("nope-" + token)).isEmpty());
    }

    @Test
    void revocation_is_persisted_and_creator_listing_is_scoped() {
        String vin = vin();
        Passport p = passport(vin, trickySnapshot(vin), "tok-" + UUID.randomUUID());
        QuarkusTransaction.requiringNew().run(() -> passports.save(p));
        Passport revoked = new Passport(p.id(), p.vin(), p.createdBy(), p.createdAt(), p.snapshot(),
                p.link().revoke(T0.plusSeconds(5)), p.pdfKey());
        QuarkusTransaction.requiringNew().run(() -> passports.save(revoked));

        assertEquals(List.of(revoked),
                QuarkusTransaction.requiringNew().call(() -> passports.findByCreator(p.createdBy())));
        assertTrue(QuarkusTransaction.requiringNew().call(() -> passports.findByCreator(UUID.randomUUID()))
                .isEmpty());
    }

    @Test
    void token_is_unique() {
        String vin = vin();
        String token = "tok-" + UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> passports.save(passport(vin, trickySnapshot(vin), token)));

        assertThrows(RuntimeException.class, () -> QuarkusTransaction.requiringNew()
                .run(() -> passports.save(passport(vin, trickySnapshot(vin), token))));
    }
}
