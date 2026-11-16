package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.AccountErasurePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/** Native SQL over the account feature's own tables; none of them has a foreign key to a user. */
@ApplicationScoped
public class AccountErasureRepository implements AccountErasurePort {

    @Inject
    EntityManager em;

    @Override
    public List<UUID> findDue(Instant now) {
        List<?> rows = em.createNativeQuery("select id from vehicle_passport.user_profile "
                        + "where deletion_scheduled_for is not null and deletion_scheduled_for <= :now "
                        + "order by deletion_scheduled_for")
                .setParameter("now", now.truncatedTo(ChronoUnit.MICROS))
                .getResultList();
        return rows.stream().map(r -> (UUID) r).toList();
    }

    @Override
    public boolean lockIfDue(UUID userId, Instant now) {
        List<?> rows = em.createNativeQuery("select deletion_scheduled_for from vehicle_passport.user_profile "
                        + "where id = :user for update")
                .setParameter("user", userId)
                .getResultList();
        if (rows.isEmpty() || rows.get(0) == null) {
            return false;
        }
        Instant scheduled = toInstant(rows.get(0));
        return !scheduled.isAfter(now.truncatedTo(ChronoUnit.MICROS));
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Instant i) {
            return i;
        }
        if (value instanceof java.time.OffsetDateTime o) {
            return o.toInstant();
        }
        if (value instanceof java.sql.Timestamp t) {
            return t.toInstant();
        }
        throw new IllegalStateException("Unexpected timestamp type " + value.getClass().getName());
    }

    @Override
    public void anonymiseConsents(UUID userId, String subjectHash) {
        em.createNativeQuery("update vehicle_passport.consent_record set user_id = null, subject_hash = :hash "
                        + "where user_id = :user")
                .setParameter("hash", subjectHash).setParameter("user", userId).executeUpdate();
    }

    @Override
    public void detachSupportReports(UUID userId) {
        em.createNativeQuery("update vehicle_passport.support_report set user_id = null where user_id = :user")
                .setParameter("user", userId).executeUpdate();
    }

    @Override
    public void deleteSettings(UUID userId) {
        em.createNativeQuery("delete from vehicle_passport.user_settings where user_id = :user")
                .setParameter("user", userId).executeUpdate();
    }

    @Override
    public void deleteProfile(UUID userId) {
        em.createNativeQuery("delete from vehicle_passport.user_profile where id = :user")
                .setParameter("user", userId).executeUpdate();
        em.clear();
    }
}
