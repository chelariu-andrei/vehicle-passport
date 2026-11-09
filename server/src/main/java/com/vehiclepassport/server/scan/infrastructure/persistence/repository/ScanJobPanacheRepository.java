package com.vehiclepassport.server.scan.infrastructure.persistence.repository;

import com.vehiclepassport.server.scan.application.port.out.ScanJobRepositoryPort;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanJob;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.DateField;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.IntField;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.NumberField;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.PartJson;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.PartsField;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.ResultJson;
import com.vehiclepassport.server.scan.infrastructure.persistence.entity.ScanJobEntity.TextField;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class ScanJobPanacheRepository implements ScanJobRepositoryPort {

    private static final String LOCK_NEXT = "select * from vehicle_passport.scan_job where status = 'PENDING'"
            + " order by created_at, id limit 1 for update skip locked";

    @Inject
    EntityManager em;

    @Override
    public void save(ScanJob job) {
        ScanJobEntity entity = em.find(ScanJobEntity.class, job.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new ScanJobEntity();
            entity.id = job.id();
        }
        entity.batchId = job.batchId();
        entity.vin = job.vin();
        entity.ownerId = job.ownerId();
        entity.periodId = job.periodId();
        entity.documentKey = job.documentKey();
        entity.contentType = job.contentType();
        entity.status = job.status().name();
        entity.attempts = job.attempts();
        entity.processingStartedAt = job.processingStartedAt() == null ? null : micros(job.processingStartedAt());
        entity.result = toJson(job.result());
        entity.warnings = job.warnings().stream().map(ScanWarning::name).toList();
        entity.failureReason = job.failureReason();
        entity.createdAt = micros(job.createdAt());
        if (isNew) {
            em.persist(entity);
        }
    }

    @Override
    public Optional<ScanJob> findById(UUID id) {
        return Optional.ofNullable(em.find(ScanJobEntity.class, id)).map(ScanJobPanacheRepository::toDomain);
    }

    /**
     * Locks the row and reloads it, so a state committed by another transaction (for example the
     * cancellation made in a separate transaction) is never hidden by this transaction's cached copy.
     */
    @Override
    public Optional<ScanJob> findByIdForUpdate(UUID id) {
        em.flush();
        ScanJobEntity entity = em.find(ScanJobEntity.class, id);
        if (entity == null) {
            return Optional.empty();
        }
        em.refresh(entity, LockModeType.PESSIMISTIC_WRITE);
        return Optional.of(toDomain(entity));
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ScanJob> lockNextPending() {
        em.flush();
        List<ScanJobEntity> found = em.createNativeQuery(LOCK_NEXT, ScanJobEntity.class).getResultList();
        if (found.isEmpty()) {
            return Optional.empty();
        }
        ScanJobEntity entity = found.get(0);
        em.refresh(entity); // a cached copy would otherwise hide the state just read under the lock
        return Optional.of(toDomain(entity));
    }

    @Override
    public List<ScanJob> findStuck(Instant startedBefore) {
        em.flush();
        return em.createQuery("from ScanJobEntity j where j.status = 'PROCESSING'"
                        + " and j.processingStartedAt < :before order by j.processingStartedAt, j.id",
                        ScanJobEntity.class)
                .setParameter("before", micros(startedBefore)).getResultList().stream()
                .map(ScanJobPanacheRepository::toDomain).toList();
    }

    @Override
    public List<ScanJob> findOpen(int limit) {
        em.flush();
        return em.createQuery("from ScanJobEntity j where j.status in ('PENDING', 'EXTRACTED')"
                        + " order by j.createdAt, j.id", ScanJobEntity.class)
                .setMaxResults(limit).getResultList().stream().map(ScanJobPanacheRepository::toDomain).toList();
    }

    /** Postgres keeps microseconds; truncating keeps comparisons identical in memory and in the table. */
    private static Instant micros(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static ResultJson toJson(ScanResult r) {
        if (r == null) {
            return null;
        }
        return new ResultJson(
                r.serviceName() == null ? null : new TextField(r.serviceName().value(), r.serviceName().confidence()),
                r.date() == null ? null : new DateField(r.date().value(), r.date().confidence()),
                r.odometerKm() == null ? null : new IntField(r.odometerKm().value(), r.odometerKm().confidence()),
                r.parts() == null ? null : new PartsField(r.parts().value() == null ? null
                        : r.parts().value().stream().map(p -> new PartJson(p.name(), p.qty(), p.price())).toList(),
                        r.parts().confidence()),
                r.labor() == null ? null : new NumberField(r.labor().value(), r.labor().confidence()),
                r.total() == null ? null : new NumberField(r.total().value(), r.total().confidence()));
    }

    private static ScanResult toDomain(ResultJson r) {
        if (r == null) {
            return null;
        }
        return new ScanResult(
                r.serviceName() == null ? null
                        : new ExtractedField<>(r.serviceName().value(), r.serviceName().confidence()),
                r.date() == null ? null : new ExtractedField<>(r.date().value(), r.date().confidence()),
                r.odometerKm() == null ? null
                        : new ExtractedField<>(r.odometerKm().value(), r.odometerKm().confidence()),
                r.parts() == null ? null : new ExtractedField<>(r.parts().value() == null ? null
                        : r.parts().value().stream().map(p -> new ExtractedPart(p.name(), p.qty(), p.price())).toList(),
                        r.parts().confidence()),
                r.labor() == null ? null : new ExtractedField<>(r.labor().value(), r.labor().confidence()),
                r.total() == null ? null : new ExtractedField<>(r.total().value(), r.total().confidence()));
    }

    private static ScanJob toDomain(ScanJobEntity e) {
        List<ScanWarning> warnings = e.warnings == null ? List.of()
                : e.warnings.stream().map(ScanWarning::valueOf).toList();
        return ScanJob.restore(e.id, e.batchId, e.vin, e.ownerId, e.periodId, e.documentKey, e.contentType,
                ScanStatus.valueOf(e.status), e.attempts, e.processingStartedAt, toDomain(e.result), warnings,
                e.failureReason, e.createdAt);
    }
}
