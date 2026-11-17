package com.vehiclepassport.server.event.infrastructure.persistence.repository;

import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.CustomField;
import com.vehiclepassport.server.event.domain.model.DetailsKind;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.Validity;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity.CustomFieldJson;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity.DetailsJson;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.VehicleEventEntity.PartJson;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Order is (event_date, created_at, id). The id column is a native uuid, which Postgres orders by unsigned bytes,
 * the same as the lowercase string order the application uses for ties.
 */
@ApplicationScoped
public class EventPanacheRepository implements EventRepositoryPort {

    private static final String ACTIVE = "from VehicleEventEntity e where e.vin = :vin and e.deletedAt is null";
    private static final String ASC = " order by e.eventDate, e.createdAt, e.id";
    /** An event without an odometer reading (allowed for some types) is no neighbour for the km check. */
    private static final String WITH_KM = " and e.odometerKm is not null";
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
        Integer previous = firstKm(em.createQuery(ACTIVE + WITH_KM + " and e.id <> :ex and (e.eventDate < :d"
                        + " or (e.eventDate = :d and e.createdAt <= :c))" + DESC, VehicleEventEntity.class)
                .setParameter("vin", vin).setParameter("ex", excludeId)
                .setParameter("d", date).setParameter("c", at));
        Integer next = firstKm(em.createQuery(ACTIVE + WITH_KM + " and e.id <> :ex and (e.eventDate > :d"
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
        entity.customLabel = event.customLabel();
        entity.notes = event.notes();
        entity.validFrom = event.validity() == null ? null : event.validity().validFrom();
        entity.validUntil = event.validity() == null ? null : event.validity().validUntil();
        entity.details = toJson(event.details());
        entity.components = toColumn(event.components());
        entity.customFields = toColumn(event.customFields());
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

    @Override
    public long countActiveByCreator(UUID userId) {
        return em.createQuery("select count(e) from VehicleEventEntity e where e.createdBy = :user "
                        + "and e.deletedAt is null", Long.class)
                .setParameter("user", userId).getSingleResult();
    }

    @Override
    public List<VehicleEvent> activeByCreator(UUID userId) {
        return em.createQuery("from VehicleEventEntity e where e.createdBy = :user and e.deletedAt is null "
                        + "order by e.vin, e.eventDate, e.createdAt, e.id", VehicleEventEntity.class)
                .setParameter("user", userId)
                .getResultList().stream().map(EventPanacheRepository::toDomain).toList();
    }

    private static Integer firstKm(TypedQuery<VehicleEventEntity> query) {
        return query.setMaxResults(1).getResultStream().findFirst().map(e -> e.odometerKm).orElse(null);
    }

    /** Postgres keeps microseconds; truncating here keeps comparisons identical in memory and in the table. */
    private static Instant micros(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static DetailsJson toJson(EventDetails details) {
        if (details == null) {
            return null;
        }
        String kind = details.kind().name();
        return switch (details) {
            case ScanDetails s -> new DetailsJson(kind, s.serviceName(),
                    s.parts().stream().map(p -> new PartJson(p.name(), p.qty(), p.price())).toList(), s.labor(),
                    null, null, null, null, null, null, null);
            case InsuranceDetails i -> new DetailsJson(kind, null, null, null,
                    i.coverage().name(), i.insurer(), i.policyNumber(), null, null, null, null);
            case RovinietaDetails r -> new DetailsJson(kind, null, null, null, null, null, null,
                    r.duration().name(), null, null, null);
            case ItpDetails i -> new DetailsJson(kind, null, null, null, null, null, null, null,
                    i.station(), i.result() == null ? null : i.result().name(), null);
            case SafetyEquipmentDetails s -> new DetailsJson(kind, null, null, null, null, null, null, null, null,
                    null, s.item().name());
        };
    }

    /** A stored value without {@code kind} predates V11 and holds scan details (spec section 11). */
    private static EventDetails toDomain(DetailsJson d) {
        if (d == null) {
            return null;
        }
        DetailsKind kind = d.kind() == null ? DetailsKind.SCAN : stored(DetailsKind.class, d.kind());
        return switch (kind) {
            case SCAN -> new ScanDetails(d.serviceName(), d.parts() == null ? List.of()
                    : d.parts().stream().map(p -> new PartLine(p.name(), p.qty(), p.price())).toList(), d.labor());
            case INSURANCE -> new InsuranceDetails(stored(InsuranceCoverage.class, d.coverage()), d.insurer(),
                    d.policyNumber());
            case ROVINIETA -> new RovinietaDetails(stored(RovinietaDuration.class, d.duration()));
            case ITP -> new ItpDetails(d.station(), d.result() == null ? null : stored(ItpResult.class, d.result()));
            case SAFETY_EQUIPMENT -> new SafetyEquipmentDetails(stored(SafetyItem.class, d.item()));
        };
    }

    /** A stored enum value that is missing or unknown is corrupt data: fail loudly instead of dropping it. */
    private static <E extends Enum<E>> E stored(Class<E> type, String value) {
        if (value == null) {
            throw new IllegalStateException("Stored " + type.getSimpleName() + " is missing");
        }
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Unknown stored " + type.getSimpleName() + ": " + value, e);
        }
    }

    private static String[] toColumn(Set<Component> components) {
        return components.stream().map(Component::name).toArray(String[]::new);
    }

    private static Set<Component> components(String[] stored) {
        EnumSet<Component> set = EnumSet.noneOf(Component.class);
        if (stored != null) {
            for (String c : stored) {
                set.add(stored(Component.class, c));
            }
        }
        return set;
    }

    private static List<CustomFieldJson> toColumn(List<CustomField> fields) {
        return fields.stream().map(c -> new CustomFieldJson(c.label(), c.value())).toList();
    }

    private static List<CustomField> customFields(List<CustomFieldJson> stored) {
        return stored == null ? List.of()
                : stored.stream().map(c -> new CustomField(c.label(), c.value())).toList();
    }

    private static Validity validity(VehicleEventEntity e) {
        return e.validFrom == null ? null : new Validity(e.validFrom, e.validUntil);
    }

    private static VehicleEvent toDomain(VehicleEventEntity e) {
        return new VehicleEvent(e.id, e.vin, EventType.valueOf(e.type), e.eventDate, e.odometerKm, e.costAmount,
                e.currency, e.customLabel, e.notes, validity(e), toDomain(e.details), components(e.components),
                customFields(e.customFields), EvidenceLevel.valueOf(e.evidence), EventSource.valueOf(e.source),
                e.createdBy, e.periodId, e.documentKey, e.createdAt, e.deletedAt);
    }

    @Override
    public void detachCreator(UUID userId, UUID tombstone) {
        em.createNativeQuery("update vehicle_passport.vehicle_event set created_by = :tombstone "
                        + "where created_by = :user")
                .setParameter("tombstone", tombstone).setParameter("user", userId).executeUpdate();
        em.clear();
    }
}
