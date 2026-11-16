package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.ErasedAccountPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** Native SQL over vehicle_passport.erased_account; the check is a single primary-key lookup. */
@ApplicationScoped
public class ErasedAccountRepository implements ErasedAccountPort {

    @Inject
    EntityManager em;

    @Override
    public void markErased(UUID userId, Instant at) {
        em.createNativeQuery("insert into vehicle_passport.erased_account (id, erased_at) values (:id, :at) "
                        + "on conflict (id) do nothing")
                .setParameter("id", userId)
                .setParameter("at", at.truncatedTo(ChronoUnit.MICROS))
                .executeUpdate();
    }

    @Override
    public boolean isErased(UUID userId) {
        return !em.createNativeQuery("select 1 from vehicle_passport.erased_account where id = :id")
                .setParameter("id", userId)
                .setMaxResults(1)
                .getResultList().isEmpty();
    }
}
