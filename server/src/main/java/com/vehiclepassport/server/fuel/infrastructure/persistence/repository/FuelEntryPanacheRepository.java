package com.vehiclepassport.server.fuel.infrastructure.persistence.repository;

import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.domain.exception.InvalidFuelEntryException;
import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import com.vehiclepassport.server.fuel.infrastructure.persistence.entity.FuelEntryEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@link #all} is ordered (entry_date, odometer_km, created_at, id), the chronological order of the calculators.
 * {@link #page} is newest first over (entry_date, odometer_km, id), which the index serves; its cursor is the
 * base64url of {@code entry_date|odometer_km|id} of the last row returned. Postgres orders the native uuid by
 * unsigned bytes, the same as the lowercase string order.
 */
@ApplicationScoped
public class FuelEntryPanacheRepository implements FuelEntryRepositoryPort {

    private static final String LIVE = "from FuelEntryEntity e where e.vin = :vin and e.periodId = :period"
            + " and e.deletedAt is null";

    @Inject
    EntityManager em;

    @Inject
    Clock clock;

    @Override
    public void lockVin(String vin) {
        // Wrapped in a count so the void result of the lock function never reaches the JDBC layer.
        em.createNativeQuery("select count(*) from (select pg_advisory_xact_lock(hashtext('fuel:' || :vin))) l")
                .setParameter("vin", vin)
                .getSingleResult();
        // Reads made before the lock may be stale once another transaction committed while this one waited.
        em.flush();
        em.clear();
    }

    @Override
    public FuelEntry save(FuelEntry entry) {
        FuelEntryEntity entity = em.find(FuelEntryEntity.class, entry.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new FuelEntryEntity();
            entity.id = entry.id();
        }
        entity.vin = entry.vin();
        entity.periodId = entry.periodId();
        entity.createdBy = entry.createdBy();
        entity.entryDate = entry.date();
        entity.odometerKm = entry.odometerKm();
        entity.fuelType = entry.fuelType().name();
        entity.quantity = entry.quantity();
        entity.total = entry.total();
        entity.unitPrice = entry.unitPrice();
        entity.currency = entry.currency();
        entity.grade = entry.grade() == null ? null : entry.grade().name();
        entity.chargeType = entry.chargeType() == null ? null : entry.chargeType().name();
        entity.station = entry.station();
        entity.note = entry.note();
        entity.fullTank = entry.fullTank();
        entity.missedPrevious = entry.missedPrevious();
        entity.createdAt = micros(entry.createdAt());
        entity.updatedAt = micros(clock.instant());
        if (isNew) {
            em.persist(entity);
        }
        return entry;
    }

    @Override
    public Optional<FuelEntry> find(String vin, UUID periodId, UUID id) {
        return em.createQuery(LIVE + " and e.id = :id", FuelEntryEntity.class)
                .setParameter("vin", vin).setParameter("period", periodId).setParameter("id", id)
                .getResultStream().findFirst().map(FuelEntryPanacheRepository::toDomain);
    }

    @Override
    public List<FuelEntry> all(String vin, UUID periodId) {
        return em.createQuery(LIVE + " order by e.entryDate, e.odometerKm, e.createdAt, e.id", FuelEntryEntity.class)
                .setParameter("vin", vin).setParameter("period", periodId)
                .getResultStream().map(FuelEntryPanacheRepository::toDomain).toList();
    }

    @Override
    public Page page(String vin, UUID periodId, String cursor, int limit) {
        Cursor after = cursor == null || cursor.isBlank() ? null : Cursor.decode(cursor);
        String where = after == null ? "" : " and (e.entryDate < :d or (e.entryDate = :d and (e.odometerKm < :km"
                + " or (e.odometerKm = :km and e.id < :id))))";
        TypedQuery<FuelEntryEntity> query = em.createQuery(
                        LIVE + where + " order by e.entryDate desc, e.odometerKm desc, e.id desc", FuelEntryEntity.class)
                .setParameter("vin", vin).setParameter("period", periodId);
        if (after != null) {
            query.setParameter("d", after.date()).setParameter("km", after.km()).setParameter("id", after.id());
        }
        List<FuelEntry> fetched = query.setMaxResults(limit + 1).getResultStream()
                .map(FuelEntryPanacheRepository::toDomain).toList();
        if (fetched.size() <= limit) {
            return new Page(fetched, null);
        }
        List<FuelEntry> window = fetched.subList(0, limit);
        FuelEntry last = window.get(limit - 1);
        return new Page(window, new Cursor(last.date(), last.odometerKm(), last.id()).encode());
    }

    @Override
    public void softDelete(UUID id, Instant at) {
        FuelEntryEntity entity = em.find(FuelEntryEntity.class, id);
        if (entity != null && entity.deletedAt == null) {
            entity.deletedAt = micros(at);
            entity.updatedAt = micros(at);
        }
    }

    @Override
    public List<FuelEntry> allByCreator(UUID createdBy) {
        return em.createQuery("from FuelEntryEntity e where e.createdBy = :by and e.deletedAt is null",
                        FuelEntryEntity.class)
                .setParameter("by", createdBy)
                .getResultStream().map(FuelEntryPanacheRepository::toDomain).toList();
    }

    @Override
    public void deleteByCreator(UUID createdBy) {
        em.createQuery("delete from FuelEntryEntity e where e.createdBy = :by")
                .setParameter("by", createdBy)
                .executeUpdate();
    }

    private static FuelEntry toDomain(FuelEntryEntity e) {
        return new FuelEntry(e.id, e.vin, e.periodId, e.createdBy, e.entryDate, e.odometerKm,
                FuelEntryType.valueOf(e.fuelType), e.quantity, e.total, e.unitPrice, e.currency,
                e.grade == null ? null : FuelGrade.valueOf(e.grade),
                e.chargeType == null ? null : ChargeType.valueOf(e.chargeType), e.station, e.note, e.fullTank,
                e.missedPrevious, e.createdAt);
    }

    /** Postgres keeps microseconds; truncating here keeps comparisons identical in memory and in the table. */
    private static Instant micros(Instant at) {
        return at.truncatedTo(ChronoUnit.MICROS);
    }

    /** Position after the last row of a page; anything that does not decode is 400 {@code validation-failed}. */
    record Cursor(LocalDate date, int km, UUID id) {

        String encode() {
            String raw = date + "|" + km + "|" + id;
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }

        static Cursor decode(String cursor) {
            try {
                String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                String[] parts = raw.split("\\|", -1);
                if (parts.length != 3) {
                    throw new IllegalArgumentException("expected 3 parts");
                }
                return new Cursor(LocalDate.parse(parts[0]), Integer.parseInt(parts[1]), UUID.fromString(parts[2]));
            } catch (RuntimeException e) {
                throw InvalidFuelEntryException.validation("Malformed cursor");
            }
        }
    }
}
