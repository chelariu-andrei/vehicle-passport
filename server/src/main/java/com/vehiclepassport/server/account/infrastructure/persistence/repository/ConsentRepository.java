package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.ConsentPort;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.account.infrastructure.persistence.entity.ConsentEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class ConsentRepository implements ConsentPort {

    @Inject
    EntityManager em;

    @Override
    public void append(List<ConsentRecord> records) {
        for (ConsentRecord r : records) {
            ConsentEntity e = new ConsentEntity();
            e.id = r.id();
            e.userId = r.userId();
            e.subjectHash = r.subjectHash();
            e.type = r.type().value();
            e.version = r.version();
            e.granted = r.granted();
            e.source = r.source().value();
            e.createdAt = r.createdAt().truncatedTo(ChronoUnit.MICROS);
            em.persist(e);
        }
        em.flush();
    }

    @Override
    public Optional<ConsentRecord> latest(UUID userId, ConsentType type) {
        return em.createQuery("from ConsentEntity where userId = :u and type = :t order by createdAt desc",
                        ConsentEntity.class)
                .setParameter("u", userId).setParameter("t", type.value()).setMaxResults(1)
                .getResultStream().findFirst().map(ConsentRepository::toDomain);
    }

    @Override
    public List<ConsentRecord> history(UUID userId) {
        return em.createQuery("from ConsentEntity where userId = :u order by createdAt desc", ConsentEntity.class)
                .setParameter("u", userId).getResultList().stream().map(ConsentRepository::toDomain).toList();
    }

    private static ConsentRecord toDomain(ConsentEntity e) {
        return new ConsentRecord(e.id, e.userId, e.subjectHash, ConsentType.fromValue(e.type), e.version, e.granted,
                ConsentSource.fromValue(e.source), e.createdAt);
    }
}
