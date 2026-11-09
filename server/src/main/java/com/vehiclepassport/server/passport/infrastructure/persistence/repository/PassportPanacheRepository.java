package com.vehiclepassport.server.passport.infrastructure.persistence.repository;

import com.vehiclepassport.server.passport.application.port.out.PassportRepositoryPort;
import com.vehiclepassport.server.passport.domain.model.Passport;
import com.vehiclepassport.server.passport.domain.model.PublicLink;
import com.vehiclepassport.server.passport.domain.model.Snapshot;
import com.vehiclepassport.server.passport.infrastructure.persistence.entity.PassportEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PassportPanacheRepository implements PassportRepositoryPort {

    @Inject
    EntityManager em;

    @Override
    public void save(Passport passport) {
        PassportEntity entity = em.find(PassportEntity.class, passport.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new PassportEntity();
            entity.id = passport.id();
        }
        entity.vin = passport.vin();
        entity.createdBy = passport.createdBy();
        entity.createdAt = micros(passport.createdAt());
        entity.snapshotJson = passport.snapshot().canonicalJson();
        entity.hash = passport.snapshot().hash();
        entity.token = passport.link().token();
        entity.expiresAt = micros(passport.link().expiresAt());
        entity.revokedAt = micros(passport.link().revokedAt());
        entity.pdfKey = passport.pdfKey();
        if (isNew) {
            em.persist(entity);
        }
        // Flush now so a duplicate token surfaces here and not at commit.
        em.flush();
    }

    @Override
    public Optional<Passport> findById(UUID id) {
        return Optional.ofNullable(em.find(PassportEntity.class, id)).map(PassportPanacheRepository::toDomain);
    }

    @Override
    public Optional<Passport> findByToken(String token) {
        return em.createQuery("from PassportEntity p where p.token = :token", PassportEntity.class)
                .setParameter("token", token).getResultStream().findFirst().map(PassportPanacheRepository::toDomain);
    }

    @Override
    public List<Passport> findByCreator(UUID userId) {
        return em.createQuery("from PassportEntity p where p.createdBy = :user", PassportEntity.class)
                .setParameter("user", userId).getResultList().stream().map(PassportPanacheRepository::toDomain)
                .toList();
    }

    /** Postgres keeps microseconds; truncating keeps values identical in memory and in the table. */
    private static Instant micros(Instant instant) {
        return instant == null ? null : instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static Passport toDomain(PassportEntity e) {
        return new Passport(e.id, e.vin, e.createdBy, e.createdAt, new Snapshot(e.snapshotJson, e.hash),
                new PublicLink(e.token, e.expiresAt, e.revokedAt), e.pdfKey);
    }
}
