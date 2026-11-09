package com.vehiclepassport.server.vehicle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.FileOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.ClaimFiled;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.Registered;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegistrationResult;
import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.application.port.out.VehicleRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.ConcurrentOwnershipChangeException;
import com.vehiclepassport.server.vehicle.domain.model.Fuel;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class VehiclePersistenceIT {

    @Inject
    VehicleRepositoryPort vehicles;
    @Inject
    OwnershipRepositoryPort ownerships;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    DecideOwnershipClaimUseCase deciding;
    @Inject
    FileOwnershipClaimUseCase filing;
    @Inject
    EntityManager em;

    private static Vehicle vehicle(Vin vin) {
        return new Vehicle(vin, "Dacia", "Duster", "1.5 dCi", 2020, Fuel.DIESEL);
    }

    private static RegisterVehicleCommand command(UUID user, String vin) {
        return new RegisterVehicleCommand(user, vin, "Dacia", "Duster", null, 2020, "DIESEL");
    }

    @Test
    void saves_and_reads_vehicle() {
        Vin vin = Vin.of(TestVins.random());
        QuarkusTransaction.requiringNew().run(() -> vehicles.save(vehicle(vin)));
        Optional<Vehicle> found = QuarkusTransaction.requiringNew().call(() -> vehicles.findByVin(vin));
        assertEquals(Optional.of(vehicle(vin)), found);
        List<Vehicle> many = QuarkusTransaction.requiringNew().call(() -> vehicles.findByVins(List.of(vin)));
        assertEquals(1, many.size());
    }

    @Test
    void concurrent_insert_of_same_new_vin_maps_to_ownership_conflict() throws Exception {
        Vin vin = Vin.of(TestVins.random());
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<Throwable> loser = QuarkusTransaction.requiringNew().call(() -> {
                vehicles.save(vehicle(vin)); // uncommitted insert holding the primary key
                Future<Throwable> f = pool.submit(() -> {
                    try {
                        QuarkusTransaction.requiringNew().run(() -> vehicles.save(vehicle(vin)));
                        return null;
                    } catch (Throwable e) {
                        return e;
                    }
                });
                try {
                    Thread.sleep(700); // let the second insert block on the key
                } catch (InterruptedException e) {
                    throw new IllegalStateException(e);
                }
                return f;
            });
            Throwable error = loser.get();
            assertTrue(error instanceof ConcurrentOwnershipChangeException, "was: " + error);
        } finally {
            pool.shutdownNow();
        }
        assertEquals(Optional.of(vehicle(vin)),
                QuarkusTransaction.requiringNew().call(() -> vehicles.findByVin(vin)));
    }

    @Test
    void findOpen_ignores_closed_periods() {
        Vin vin = Vin.of(TestVins.random());
        UUID owner = UUID.randomUUID();
        Instant t0 = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        QuarkusTransaction.requiringNew().run(() -> {
            vehicles.save(vehicle(vin));
            ownerships.save(new OwnershipPeriod(UUID.randomUUID(), vin, owner, t0, t0.plusSeconds(5)));
        });
        assertTrue(QuarkusTransaction.requiringNew().call(() -> ownerships.findOpen(vin)).isEmpty());
        assertTrue(QuarkusTransaction.requiringNew().call(() -> ownerships.findOpenByOwner(owner)).isEmpty());
    }

    @Test
    void second_open_period_for_same_vin_violates_index() {
        Vin vin = Vin.of(TestVins.random());
        Instant t0 = Instant.now();
        QuarkusTransaction.requiringNew().run(() -> {
            vehicles.save(vehicle(vin));
            ownerships.save(new OwnershipPeriod(UUID.randomUUID(), vin, UUID.randomUUID(), t0, null));
        });
        assertThrows(ConcurrentOwnershipChangeException.class, () -> QuarkusTransaction.requiringNew().run(
                () -> ownerships.save(new OwnershipPeriod(UUID.randomUUID(), vin, UUID.randomUUID(), t0, null))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void flyway_created_tables_in_vehicle_passport_schema() {
        List<String> schemas = QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select table_schema from information_schema.tables where table_name = 'ownership_period'")
                .getResultList());
        assertEquals(List.of("vehicle_passport"), schemas);
    }

    @Test
    void concurrent_registration_yields_one_owner() throws Exception {
        String vin = TestVins.random();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<RegistrationResult> ra = () -> {
                start.await();
                return registering.register(command(a, vin));
            };
            Callable<RegistrationResult> rb = () -> {
                start.await();
                return registering.register(command(b, vin));
            };
            List<Future<RegistrationResult>> futures = List.of(pool.submit(ra), pool.submit(rb));
            start.countDown();
            List<RegistrationResult> results = new ArrayList<>();
            for (Future<RegistrationResult> f : futures) {
                results.add(f.get());
            }
            assertEquals(1, results.stream().filter(r -> r instanceof Registered).count(),
                    "exactly one caller registers");
            assertEquals(1, results.stream().filter(r -> r instanceof ClaimFiled).count(),
                    "the other caller files a claim");
        } finally {
            pool.shutdownNow();
        }
        Number open = (Number) QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select count(*) from vehicle_passport.ownership_period where vin = ?1 and owned_to is null")
                .setParameter(1, vin).getSingleResult());
        assertEquals(1, open.intValue());
        Number pending = (Number) QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select count(*) from vehicle_passport.ownership_claim where vin = ?1 and status = 'PENDING'")
                .setParameter(1, vin).getSingleResult());
        assertEquals(1, pending.intValue());
    }

    @Test
    void approve_closes_old_period_before_inserting_new_one() {
        String vin = TestVins.random();
        UUID owner = UUID.randomUUID();
        UUID claimant = UUID.randomUUID();
        assertInstanceOf(Registered.class, registering.register(command(owner, vin)));
        ClaimFiled filed = assertInstanceOf(ClaimFiled.class, registering.register(command(claimant, vin)));

        deciding.approve(vin, filed.claimId(), owner);

        assertEquals(claimant, QuarkusTransaction.requiringNew()
                .call(() -> ownerships.findOpen(Vin.of(vin))).orElseThrow().ownerId());
        assertTrue(QuarkusTransaction.requiringNew().call(() -> ownerships.findOpenByOwner(owner)).isEmpty());
    }

    private String claimStatus(UUID claimId) {
        return (String) QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select status from vehicle_passport.ownership_claim where id = ?1")
                .setParameter(1, claimId).getSingleResult());
    }

    private int openPeriods(String vin) {
        return ((Number) QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select count(*) from vehicle_passport.ownership_period where vin = ?1 and owned_to is null")
                .setParameter(1, vin).getSingleResult())).intValue();
    }

    private UUID openOwner(String vin) {
        return QuarkusTransaction.requiringNew().call(() -> ownerships.findOpen(Vin.of(vin))).orElseThrow().ownerId();
    }

    /** Runs both actions released together; returns the domain error of each, or null when it succeeded. */
    private DomainException[] race(Runnable first, Runnable second) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<DomainException>> futures = new ArrayList<>();
            for (Runnable action : List.of(first, second)) {
                futures.add(pool.submit(() -> {
                    start.await();
                    try {
                        action.run();
                        return null;
                    } catch (DomainException e) {
                        return e;
                    }
                }));
            }
            start.countDown();
            return new DomainException[] {futures.get(0).get(), futures.get(1).get()};
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrent_approves_of_different_claims_yield_one_new_owner() throws Exception {
        for (int i = 0; i < 5; i++) {
            String vin = TestVins.random();
            UUID owner = UUID.randomUUID();
            UUID a = UUID.randomUUID();
            UUID b = UUID.randomUUID();
            registering.register(command(owner, vin));
            UUID claimA = ((ClaimFiled) registering.register(command(a, vin))).claimId();
            UUID claimB = ((ClaimFiled) registering.register(command(b, vin))).claimId();

            DomainException[] errors = race(() -> deciding.approve(vin, claimA, owner),
                    () -> deciding.approve(vin, claimB, owner));

            assertEquals(1, openPeriods(vin));
            assertEquals(1, java.util.Arrays.stream(errors).filter(e -> e == null).count(), "one approve wins");
            boolean aWon = errors[0] == null;
            assertEquals(aWon ? a : b, openOwner(vin));
            assertEquals(aWon ? "APPROVED" : "REJECTED", claimStatus(claimA));
            assertEquals(aWon ? "REJECTED" : "APPROVED", claimStatus(claimB));
        }
    }

    @Test
    void approve_racing_withdraw_of_same_claim_stays_consistent() throws Exception {
        for (int i = 0; i < 5; i++) {
            String vin = TestVins.random();
            UUID owner = UUID.randomUUID();
            UUID claimant = UUID.randomUUID();
            registering.register(command(owner, vin));
            UUID claim = ((ClaimFiled) registering.register(command(claimant, vin))).claimId();

            DomainException[] errors = race(() -> deciding.approve(vin, claim, owner),
                    () -> filing.withdraw(claim, claimant));

            assertEquals(1, openPeriods(vin));
            assertEquals(1, java.util.Arrays.stream(errors).filter(e -> e == null).count(), "exactly one wins");
            boolean approved = errors[0] == null;
            assertEquals(approved ? "APPROVED" : "WITHDRAWN", claimStatus(claim));
            assertEquals(approved ? claimant : owner, openOwner(vin));
        }
    }

    @Test
    void withdraw_blocked_behind_a_committing_approve_does_not_overwrite_it() throws Exception {
        String vin = TestVins.random();
        UUID owner = UUID.randomUUID();
        UUID claimant = UUID.randomUUID();
        registering.register(command(owner, vin));
        UUID claim = ((ClaimFiled) registering.register(command(claimant, vin))).claimId();

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<DomainException> withdrawn = QuarkusTransaction.requiringNew().call(() -> {
                ownerships.lockVin(Vin.of(vin)); // this transaction holds the VIN while withdraw starts
                Future<DomainException> f = pool.submit(() -> {
                    try {
                        filing.withdraw(claim, claimant);
                        return null;
                    } catch (DomainException e) {
                        return e;
                    }
                });
                try {
                    Thread.sleep(700); // let withdraw read the claim and block on the lock
                } catch (InterruptedException e) {
                    throw new IllegalStateException(e);
                }
                deciding.approve(vin, claim, owner);
                return f;
            });
            DomainException error = withdrawn.get();
            assertEquals("claim-not-pending", error.code());
        } finally {
            pool.shutdownNow();
        }
        assertEquals("APPROVED", claimStatus(claim));
        assertEquals(claimant, openOwner(vin));
        assertEquals(1, openPeriods(vin));
    }
}
