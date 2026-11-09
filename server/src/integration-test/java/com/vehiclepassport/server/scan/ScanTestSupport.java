package com.vehiclepassport.server.scan;

import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import com.vehiclepassport.server.testsupport.fake.FakeReceiptExtraction;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

/** Fixtures for the scan integration tests that run against Postgres. */
@ApplicationScoped
public class ScanTestSupport {

    private static final String ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

    public record Fixture(String vin, UUID owner, UUID period) {
    }

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    ScanJobRepositoryPort jobs;

    public static String randomVin() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(ALPHABET.charAt(r.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    public Fixture register(UUID owner) {
        String vin = randomVin();
        registering.register(new RegisterVehicleCommand(owner, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        return new Fixture(vin, owner, owners.assertActiveOwner(vin, owner).periodId());
    }

    public ScanJob pending(Fixture f, Instant createdAt) {
        UUID id = UUID.randomUUID();
        ScanJob job = new ScanJob(id, UUID.randomUUID(), f.vin(), f.owner(), f.period(), "scans/" + f.vin() + "/" + id,
                "image/png", createdAt);
        save(job);
        return job;
    }

    public ScanJob extracted(Fixture f) {
        ScanJob job = pending(f, Instant.now());
        job.startProcessing(Instant.now());
        job.extracted(FakeReceiptExtraction.defaultResult(), List.of(ScanWarning.TOTAL_MISMATCH));
        save(job);
        return job;
    }

    public ScanJob extracted(Fixture f, ScanResult result) {
        ScanJob job = pending(f, Instant.now());
        job.startProcessing(Instant.now());
        job.extracted(result, List.of());
        save(job);
        return job;
    }

    public void save(ScanJob job) {
        QuarkusTransaction.requiringNew().run(() -> jobs.save(job));
    }

    public ScanJob reload(UUID id) {
        return QuarkusTransaction.requiringNew().call(() -> jobs.findById(id).orElseThrow());
    }

    public void inTransaction(Consumer<ScanJobRepositoryPort> work) {
        QuarkusTransaction.requiringNew().run(() -> work.accept(jobs));
    }
}
