package com.vehiclepassport.server.scan;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.application.service.ScanJobStateService;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import com.vehiclepassport.server.scan.ScanTestSupport.Fixture;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class ScanPersistenceIT {

    @Inject
    ScanTestSupport support;
    @Inject
    ScanJobRepositoryPort jobs;
    @Inject
    ScanJobStateService state;

    private Fixture fixture() {
        return support.register(UUID.randomUUID());
    }

    @Test
    void result_and_warnings_round_trip() {
        Fixture f = fixture();
        ScanResult result = new ScanResult(
                new ExtractedField<>("Auto Service SRL", 0.95),
                new ExtractedField<>(LocalDate.of(2025, 6, 1), 0.9),
                new ExtractedField<>(120000, 0.8),
                new ExtractedField<>(List.of(new ExtractedPart("Oil filter", new BigDecimal("2.5"),
                        new BigDecimal("120.40"))), 0.85),
                null,
                new ExtractedField<>(new BigDecimal("400.25"), 0.9));
        ScanJob job = support.pending(f, Instant.now());
        job.startProcessing(Instant.now());
        job.extracted(result, List.of(ScanWarning.TOTAL_MISMATCH, ScanWarning.DATE_IN_FUTURE));
        support.save(job);

        ScanJob loaded = support.reload(job.id());

        assertEquals(ScanStatus.EXTRACTED, loaded.status());
        assertEquals(1, loaded.attempts());
        assertEquals(List.of(ScanWarning.TOTAL_MISMATCH, ScanWarning.DATE_IN_FUTURE), loaded.warnings());
        assertEquals(result, loaded.result());
        assertEquals(f.period(), loaded.periodId());
        assertEquals(job.documentKey(), loaded.documentKey());
    }

    @Test
    void pending_job_has_no_result_and_an_empty_warning_list() {
        ScanJob job = support.pending(fixture(), Instant.now());

        ScanJob loaded = support.reload(job.id());

        assertEquals(ScanStatus.PENDING, loaded.status());
        assertEquals(null, loaded.result());
        assertEquals(List.of(), loaded.warnings());
    }

    @Test
    void lockNextPending_oldest_first() {
        Fixture f = fixture();
        ScanJob newer = support.pending(f, Instant.parse("1980-01-02T00:00:00Z"));
        ScanJob older = support.pending(f, Instant.parse("1980-01-01T00:00:00Z"));

        List<UUID> order = QuarkusTransaction.requiringNew().call(() -> {
            ScanJob first = jobs.lockNextPending().orElseThrow();
            first.startProcessing(Instant.now());
            jobs.save(first);
            ScanJob second = jobs.lockNextPending().orElseThrow();
            second.startProcessing(Instant.now());
            jobs.save(second);
            return List.of(first.id(), second.id());
        });

        assertEquals(List.of(older.id(), newer.id()), order);
        assertEquals(ScanStatus.PROCESSING, support.reload(older.id()).status());
    }

    @Test
    void findStuck_uses_timeout() {
        Fixture f = fixture();
        Instant now = Instant.now();
        ScanJob stale = processing(f, now.minusSeconds(600));
        ScanJob fresh = processing(f, now.minusSeconds(60));

        List<UUID> stuck = QuarkusTransaction.requiringNew().call(
                () -> jobs.findStuck(now.minusSeconds(300)).stream().map(ScanJob::id).toList());

        assertTrue(stuck.contains(stale.id()));
        assertTrue(!stuck.contains(fresh.id()));
    }

    @Test
    void two_workers_never_claim_the_same_job() throws Exception {
        Fixture f = fixture();
        support.pending(f, Instant.parse("1990-01-01T00:00:00Z"));
        support.pending(f, Instant.parse("1990-01-02T00:00:00Z"));
        CountDownLatch bothClaimed = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<UUID> a = pool.submit(() -> claimAndHold(bothClaimed, release));
            Future<UUID> b = pool.submit(() -> claimAndHold(bothClaimed, release));
            assertTrue(bothClaimed.await(30, TimeUnit.SECONDS), "both workers should hold a lock at once");
            release.countDown();
            assertNotEquals(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    private UUID claimAndHold(CountDownLatch claimed, CountDownLatch release) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Optional<ScanJob> job = jobs.lockNextPending();
            claimed.countDown();
            try {
                release.await(30, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return job.orElseThrow().id();
        });
    }

    @Test
    void stuck_processing_job_returns_to_pending_and_fails_after_three_attempts() {
        Fixture f = fixture();
        Instant longAgo = Instant.now().minusSeconds(3600);
        ScanJob job = processing(f, longAgo); // attempt 1

        state.recoverStuck();
        ScanJob afterFirst = support.reload(job.id());
        assertEquals(ScanStatus.PENDING, afterFirst.status());
        assertEquals(1, afterFirst.attempts());

        afterFirst.startProcessing(longAgo); // attempt 2
        support.save(afterFirst);
        state.recoverStuck();
        ScanJob afterSecond = support.reload(job.id());
        assertEquals(ScanStatus.PENDING, afterSecond.status());

        afterSecond.startProcessing(longAgo); // attempt 3
        support.save(afterSecond);
        state.recoverStuck();
        ScanJob afterThird = support.reload(job.id());
        assertEquals(ScanStatus.FAILED, afterThird.status());
        assertEquals(3, afterThird.attempts());
        assertEquals("processing timeout", afterThird.failureReason());
    }

    private ScanJob processing(Fixture f, Instant startedAt) {
        ScanJob job = support.pending(f, Instant.now());
        job.startProcessing(startedAt);
        support.save(job);
        return job;
    }
}
