package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.domain.model.DisplayName;
import com.vehiclepassport.server.account.domain.model.PhoneNumber;
import com.vehiclepassport.server.account.domain.model.Profile;
import com.vehiclepassport.server.account.infrastructure.persistence.entity.ProfileEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class ProfileRepository implements ProfilePort {

    @Inject
    EntityManager em;

    @Override
    public Profile upsertIfAbsent(Profile profile) {
        // Two first calls racing: the loser's insert is skipped and it reads the winner's committed row.
        em.createNativeQuery("insert into vehicle_passport.user_profile (id, email, display_name, phone, created_at, "
                        + "deletion_scheduled_for) values (:id, :email, :name, :phone, :createdAt, :deletion) "
                        + "on conflict (id) do nothing")
                .setParameter("id", profile.id())
                .setParameter("email", profile.email())
                .setParameter("name", profile.displayName() == null ? null : profile.displayName().value())
                .setParameter("phone", profile.phone() == null ? null : profile.phone().value())
                .setParameter("createdAt", micros(profile.createdAt()))
                .setParameter("deletion", micros(profile.deletionScheduledFor()))
                .executeUpdate();
        return findById(profile.id()).orElseThrow();
    }

    @Override
    public Optional<Profile> findById(UUID id) {
        return Optional.ofNullable(em.find(ProfileEntity.class, id)).map(ProfileRepository::toDomain);
    }

    @Override
    public void save(Profile profile) {
        ProfileEntity entity = em.find(ProfileEntity.class, profile.id());
        boolean isNew = entity == null;
        if (isNew) {
            entity = new ProfileEntity();
            entity.id = profile.id();
        }
        entity.email = profile.email();
        entity.displayName = profile.displayName() == null ? null : profile.displayName().value();
        entity.phone = profile.phone() == null ? null : profile.phone().value();
        entity.createdAt = micros(profile.createdAt());
        entity.deletionScheduledFor = micros(profile.deletionScheduledFor());
        if (isNew) {
            em.persist(entity);
        }
        em.flush();
    }

    /** Postgres keeps microseconds; truncating keeps values identical in memory and in the table. */
    private static Instant micros(Instant instant) {
        return instant == null ? null : instant.truncatedTo(ChronoUnit.MICROS);
    }

    private static Profile toDomain(ProfileEntity e) {
        return new Profile(e.id, e.email, e.displayName == null ? null : DisplayName.of(e.displayName),
                e.phone == null ? null : PhoneNumber.of(e.phone), e.createdAt, e.deletionScheduledFor);
    }
}
