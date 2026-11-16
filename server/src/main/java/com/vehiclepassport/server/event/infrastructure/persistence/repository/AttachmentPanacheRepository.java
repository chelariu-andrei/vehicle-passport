package com.vehiclepassport.server.event.infrastructure.persistence.repository;

import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.domain.exception.DuplicateDocumentException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.event.infrastructure.persistence.entity.EventAttachmentEntity;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.hibernate.exception.ConstraintViolationException;

@ApplicationScoped
public class AttachmentPanacheRepository implements AttachmentRepositoryPort {

    private static final String UPLOAD_HASH_INDEX = "event_attachment_upload_hash";
    private static final String LIVE = "from EventAttachmentEntity a where a.deletedAt is null";

    @Inject
    EntityManager em;

    @Override
    public void save(Attachment attachment) {
        if (attachment.kind() == AttachmentKind.UPLOAD && attachment.deletedAt() == null
                && attachment.sha256() != null) {
            Optional<Attachment> existing = findLiveUploadByHash(attachment.vin(), attachment.sha256());
            if (existing.isPresent() && !existing.get().id().equals(attachment.id())) {
                throw new DuplicateDocumentException(existing.get().eventId());
            }
        }
        EventAttachmentEntity entity = em.find(EventAttachmentEntity.class, attachment.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new EventAttachmentEntity();
            entity.id = attachment.id();
        }
        entity.eventId = attachment.eventId();
        entity.vin = attachment.vin();
        entity.sha256 = attachment.sha256();
        entity.contentType = attachment.contentType();
        entity.sizeBytes = attachment.sizeBytes();
        entity.storageKey = attachment.storageKey();
        entity.kind = attachment.kind().name();
        entity.createdBy = attachment.createdBy();
        entity.createdAt = micros(attachment.createdAt());
        entity.deletedAt = attachment.deletedAt() == null ? null : micros(attachment.deletedAt());
        if (isNew) {
            em.persist(entity);
        }
        try {
            em.flush();
        } catch (PersistenceException e) {
            if (attachment.kind() == AttachmentKind.UPLOAD && attachment.sha256() != null
                    && isUploadHashViolation(e)) {
                // Lost a race with a concurrent insert. The failed statement aborts this transaction (Postgres
                // rejects further queries in it), so the winner is looked up in a separate REQUIRES_NEW one.
                // The winner may have been soft-deleted meanwhile; then no event id is known.
                UUID eventId = QuarkusTransaction.requiringNew()
                        .call(() -> findLiveUploadByHash(attachment.vin(), attachment.sha256()))
                        .map(Attachment::eventId).orElse(null);
                throw new DuplicateDocumentException(eventId);
            }
            throw e;
        }
    }

    /** SQLState 23505 on the upload hash index, found anywhere in the cause chain. */
    private static boolean isUploadHashViolation(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof ConstraintViolationException cve
                    && cve.getKind() == ConstraintViolationException.ConstraintKind.UNIQUE
                    && (cve.getConstraintName() == null || cve.getConstraintName().contains(UPLOAD_HASH_INDEX))) {
                return true;
            }
            if (t instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage() != null && sql.getMessage().contains(UPLOAD_HASH_INDEX)) {
                return true;
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return false;
    }

    @Override
    public Optional<Attachment> findLive(UUID eventId, UUID id) {
        return em.createQuery("select a " + LIVE + " and a.eventId = :e and a.id = :id", EventAttachmentEntity.class)
                .setParameter("e", eventId).setParameter("id", id)
                .getResultStream().findFirst().map(AttachmentPanacheRepository::toDomain);
    }

    @Override
    public List<Attachment> liveFor(UUID eventId) {
        return em.createQuery("select a " + LIVE + " and a.eventId = :e order by a.createdAt, a.id",
                        EventAttachmentEntity.class)
                .setParameter("e", eventId).getResultList().stream()
                .map(AttachmentPanacheRepository::toDomain).toList();
    }

    @Override
    public int countLive(UUID eventId) {
        return em.createQuery("select count(a) " + LIVE + " and a.eventId = :e", Long.class)
                .setParameter("e", eventId).getSingleResult().intValue();
    }

    @Override
    public Optional<Attachment> findLiveUploadByHash(String vin, String sha256) {
        return em.createQuery("select a " + LIVE + " and a.vin = :vin and a.sha256 = :h and a.kind = 'UPLOAD'",
                        EventAttachmentEntity.class)
                .setParameter("vin", vin).setParameter("h", sha256)
                .getResultStream().findFirst().map(AttachmentPanacheRepository::toDomain);
    }

    @Override
    public void softDelete(UUID id, Instant at) {
        em.createQuery("update EventAttachmentEntity a set a.deletedAt = :at where a.id = :id and a.deletedAt is null")
                .setParameter("at", micros(at)).setParameter("id", id).executeUpdate();
        em.flush();
        em.clear();
    }

    @Override
    public void softDeleteAllFor(UUID eventId, Instant at) {
        em.createQuery("update EventAttachmentEntity a set a.deletedAt = :at "
                        + "where a.eventId = :e and a.deletedAt is null")
                .setParameter("at", micros(at)).setParameter("e", eventId).executeUpdate();
        em.flush();
        em.clear();
    }

    @Override
    public Map<UUID, Integer> countsFor(Collection<UUID> eventIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        if (eventIds.isEmpty()) {
            return counts;
        }
        em.createQuery("select a.eventId, count(a) " + LIVE + " and a.eventId in :ids group by a.eventId",
                        Object[].class)
                .setParameter("ids", eventIds).getResultList()
                .forEach(r -> counts.put((UUID) r[0], ((Long) r[1]).intValue()));
        return counts;
    }

    /** Postgres timestamptz keeps microseconds. */
    private static Instant micros(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static Attachment toDomain(EventAttachmentEntity e) {
        return new Attachment(e.id, e.eventId, e.vin, e.sha256 == null ? null : e.sha256.strip(), e.contentType,
                e.sizeBytes, e.storageKey, AttachmentKind.valueOf(e.kind), e.createdBy, e.createdAt, e.deletedAt);
    }
}
