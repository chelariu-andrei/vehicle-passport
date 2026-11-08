package com.vehiclepassport.server.vehicle.infrastructure.persistence.repository;

import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.ConcurrentOwnershipChangeException;
import com.vehiclepassport.server.vehicle.domain.model.ClaimStatus;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipClaim;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import com.vehiclepassport.server.vehicle.infrastructure.persistence.entity.OwnershipClaimEntity;
import com.vehiclepassport.server.vehicle.infrastructure.persistence.entity.OwnershipPeriodEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Periods and claims share one adapter so the advisory lock, the flush ordering and the unique-violation mapping
 * live in one place.
 */
@ApplicationScoped
public class OwnershipPanacheRepository implements OwnershipRepositoryPort {

    private static final String UNIQUE_VIOLATION = "23505";

    @Inject
    EntityManager em;

    @Override
    public void lockVin(Vin vin) {
        // Wrapped in a count so the void result of the lock function never reaches the JDBC layer.
        em.createNativeQuery("select count(*) from (select pg_advisory_xact_lock(hashtext(:vin))) l")
                .setParameter("vin", vin.value())
                .getSingleResult();
    }

    @Override
    public Optional<OwnershipPeriod> findOpen(Vin vin) {
        return em.createQuery("from OwnershipPeriodEntity where vin = :vin and ownedTo is null",
                        OwnershipPeriodEntity.class)
                .setParameter("vin", vin.value()).getResultStream().findFirst().map(this::toDomain);
    }

    @Override
    public Optional<OwnershipPeriod> findById(UUID id) {
        return Optional.ofNullable(em.find(OwnershipPeriodEntity.class, id)).map(this::toDomain);
    }

    @Override
    public List<OwnershipPeriod> findOpenByOwner(UUID ownerId) {
        return em.createQuery("from OwnershipPeriodEntity where ownerId = :owner and ownedTo is null "
                        + "order by ownedFrom", OwnershipPeriodEntity.class)
                .setParameter("owner", ownerId).getResultList().stream().map(this::toDomain).toList();
    }

    @Override
    public void save(OwnershipPeriod period) {
        OwnershipPeriodEntity entity = em.find(OwnershipPeriodEntity.class, period.id());
        if (entity == null) {
            entity = new OwnershipPeriodEntity();
            entity.id = period.id();
        }
        entity.vin = period.vin().value();
        entity.ownerId = period.ownerId();
        entity.ownedFrom = period.from();
        entity.ownedTo = period.to();
        persistAndFlush(entity);
    }

    @Override
    public Optional<OwnershipClaim> findClaim(UUID id) {
        return Optional.ofNullable(em.find(OwnershipClaimEntity.class, id)).map(this::toDomain);
    }

    @Override
    public Optional<OwnershipClaim> findPendingClaim(Vin vin, UUID claimantId) {
        return em.createQuery("from OwnershipClaimEntity where vin = :vin and claimantId = :c and status = :s",
                        OwnershipClaimEntity.class)
                .setParameter("vin", vin.value()).setParameter("c", claimantId)
                .setParameter("s", ClaimStatus.PENDING.name())
                .getResultStream().findFirst().map(this::toDomain);
    }

    @Override
    public List<OwnershipClaim> findPendingClaims(Vin vin) {
        return em.createQuery("from OwnershipClaimEntity where vin = :vin and status = :s order by filedAt",
                        OwnershipClaimEntity.class)
                .setParameter("vin", vin.value()).setParameter("s", ClaimStatus.PENDING.name())
                .getResultList().stream().map(this::toDomain).toList();
    }

    @Override
    public void save(OwnershipClaim claim) {
        OwnershipClaimEntity entity = em.find(OwnershipClaimEntity.class, claim.id());
        if (entity == null) {
            entity = new OwnershipClaimEntity();
            entity.id = claim.id();
        }
        entity.vin = claim.vin().value();
        entity.claimantId = claim.claimantId();
        entity.status = claim.status().name();
        entity.filedAt = claim.filedAt();
        entity.decidedAt = claim.decidedAt();
        persistAndFlush(entity);
    }

    /**
     * Flushes immediately: Hibernate would otherwise run the inserts of a transaction before its updates, so a
     * new open period could hit the not yet closed old one. It also makes a unique violation surface here, where
     * it can be mapped, instead of at commit.
     */
    private void persistAndFlush(Object entity) {
        try {
            em.persist(entity);
            em.flush();
        } catch (PersistenceException e) {
            if (isUniqueViolation(e)) {
                throw new ConcurrentOwnershipChangeException(
                        "The ownership of this vehicle was changed concurrently; retry");
            }
            throw e;
        }
    }

    private static boolean isUniqueViolation(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && UNIQUE_VIOLATION.equals(sql.getSQLState())) {
                return true;
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return false;
    }

    private OwnershipPeriod toDomain(OwnershipPeriodEntity e) {
        return new OwnershipPeriod(e.id, new Vin(e.vin), e.ownerId, e.ownedFrom, e.ownedTo);
    }

    private OwnershipClaim toDomain(OwnershipClaimEntity e) {
        return new OwnershipClaim(e.id, new Vin(e.vin), e.claimantId, ClaimStatus.valueOf(e.status), e.filedAt,
                e.decidedAt);
    }
}
