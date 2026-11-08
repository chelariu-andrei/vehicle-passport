package com.vehiclepassport.server.vehicle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
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
}
