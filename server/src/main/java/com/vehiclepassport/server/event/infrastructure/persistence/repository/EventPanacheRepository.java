package com.vehiclepassport.server.event.infrastructure.persistence.repository;

import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity.DetailsJson;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity.PartJson;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Order is (event_date, created_at, id). The id column is a native uuid, which Postgres orders by unsigned bytes,
 * the same as the lowercase string order the application uses for ties.
 */
@ApplicationScoped
public class EventPanacheRepository implements EventRepositoryPort {

    private static final String ACTIVE = "from VehicleEventEntity e where e.vin = :vin and e.deletedAt is null";
    private static final String ASC = " order by e.eventDate, e.createdAt, e.id";
    private static final String DESC = " order by e.eventDate desc, e.createdAt desc, e.id desc";

    @Inject
    EntityManager em;

    @Override
    public void lockTimeline(String vin) {
        // Wrapped in a count so the void result of the lock function never reaches the JDBC layer.
        em.createNativeQuery(
                        "select count(*) from (select pg_advisory_xact_lock(hashtext('timeline:' || :vin))) l")
                .setParameter("vin", vin)
                .getSingleResult();
        // Reads made before the lock may be stale once another transaction committed while this one waited.
        em.flush();
        em.clear();
    }

    @Override
    public Optional<VehicleEvent> findActive(String vin, UUID id) {
        return em.createQuery(ACTIVE + " and e.id = :id", VehicleEventEntity.class)
                .setParameter("vin", vin).setParameter("id", id)
                .getResultStream().findFirst().map(EventPanacheRepository::toDomain);
    }

    @Override
    public Neighbours neighbours(String vin, LocalDate date, Instant createdAt, UUID excludeId) {
        Instant at = micros(createdAt);
        Integer previous = firstKm(em.createQuery(ACTIVE + " and e.id <> :ex and (e.eventDate < :d"
                        + " or (e.eventDate = :d and e.createdAt <= :c))" + DESC, VehicleEventEntity.class)
                .setParameter("vin", vin).setParameter("ex", excludeId)
                .setParameter("d", date).setParameter("c", at));
        Integer next = firstKm(em.createQuery(ACTIVE + " and e.id <> :ex and (e.eventDate > :d"
                        + " or (e.eventDate = :d and e.createdAt > :c))" + ASC, VehicleEventEntity.class)
                .setParameter("vin", vin).setParameter("ex", excludeId)
                .setParameter("d", date).setParameter("c", at));
        return new Neighbours(previous, next);
    }

    @Override
    public void save(VehicleEvent event) {
        VehicleEventEntity entity = em.find(VehicleEventEntity.class, event.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new VehicleEventEntity();
            entity.id = event.id();
        }
        entity.vin = event.vin();
        entity.type = event.type().name();
        entity.eventDate = event.date();
        entity.odometerKm = event.odometerKm();
        entity.costAmount = event.costAmount();
        entity.currency = event.currency();
        entity.notes = event.notes();
        entity.details = toJson(event.details());
        entity.evidence = event.evidence().name();
        entity.source = event.source().name();
        entity.createdBy = event.createdBy();
        entity.periodId = event.periodId();
        entity.documentKey = event.documentKey();
        entity.createdAt = micros(event.createdAt());
        entity.deletedAt = event.deletedAt() == null ? null : micros(event.deletedAt());
        if (isNew) {
            em.persist(entity);
        }
    }

    @Override
    public List<VehicleEvent> page(String vin, TimelineCursor after, int limit) {
        TypedQuery<VehicleEventEntity> query;
        if (after == null) {
            query = em.createQuery(ACTIVE + ASC, VehicleEventEntity.class);
        } else {
            query = em.createQuery(ACTIVE + " and (e.eventDate > :d or (e.eventDate = :d and e.createdAt > :c)"
                            + " or (e.eventDate = :d and e.createdAt = :c and e.id > :id))" + ASC,
                            VehicleEventEntity.class)
                    .setParameter("d", after.date()).setParameter("c", micros(after.createdAt()))
                    .setParameter("id", after.id());
        }
        return query.setParameter("vin", vin).setMaxResults(limit).getResultList().stream()
                .map(EventPanacheRepository::toDomain).toList();
    }

    @Override
    public List<VehicleEvent> allActive(String vin) {
        return em.createQuery(ACTIVE + ASC, VehicleEventEntity.class).setParameter("vin", vin)
                .getResultList().stream().map(EventPanacheRepository::toDomain).toList();
    }

    private static Integer firstKm(TypedQuery<VehicleEventEntity> query) {
        return query.setMaxResults(1).getResultStream().findFirst().map(e -> e.odometerKm).orElse(null);
    }

    /** Postgres keeps microseconds; truncating here keeps comparisons identical in memory and in the table. */
    private static Instant micros(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static DetailsJson toJson(EventDetails d) {
        if (d == null) {
            return null;
        }
        return new DetailsJson(d.serviceName(),
                d.parts().stream().map(p -> new PartJson(p.name(), p.qty(), p.price())).toList(), d.labor());
    }

    private static EventDetails toDomain(DetailsJson d) {
        if (d == null) {
            return null;
        }
        List<PartLine> parts = d.parts() == null ? List.of()
                : d.parts().stream().map(p -> new PartLine(p.name(), p.qty(), p.price())).toList();
        return new EventDetails(d.serviceName(), parts, d.labor());
    }

    private static VehicleEvent toDomain(VehicleEventEntity e) {
        return new VehicleEvent(e.id, e.vin, EventType.valueOf(e.type), e.eventDate, e.odometerKm, e.costAmount,
                e.currency, e.notes, toDomain(e.details), EvidenceLevel.valueOf(e.evidence),
                EventSource.valueOf(e.source), e.createdBy, e.periodId, e.documentKey, e.createdAt, e.deletedAt);
    }
}
