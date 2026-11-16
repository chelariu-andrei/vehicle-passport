package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.CancelDeletionUseCase;
import com.vehiclepassport.server.account.application.port.in.ScheduleDeletionUseCase;
import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.domain.exception.DeletionAlreadyScheduledException;
import com.vehiclepassport.server.account.domain.exception.DeletionNotScheduledException;
import com.vehiclepassport.server.account.domain.model.Profile;
import com.vehiclepassport.server.shared.config.AccountConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@ApplicationScoped
public class AccountDeletionService implements ScheduleDeletionUseCase, CancelDeletionUseCase {

    private final ProfilePort profiles;
    private final Clock clock;
    private final AccountConfig config;

    @Inject
    public AccountDeletionService(ProfilePort profiles, Clock clock, AccountConfig config) {
        this.profiles = profiles;
        this.clock = clock;
        this.config = config;
    }

    @Override
    @Transactional
    public Instant schedule(UUID userId) {
        Profile profile = profiles.upsertIfAbsent(new Profile(userId, null, null, null, clock.instant(), null));
        if (profile.deletionScheduled()) {
            throw new DeletionAlreadyScheduledException("Deletion is already scheduled for "
                    + profile.deletionScheduledFor());
        }
        Instant when = clock.instant().plus(Duration.ofDays(config.deletion().graceDays()));
        profiles.save(withSchedule(profile, when));
        return when;
    }

    @Override
    @Transactional
    public void cancel(UUID userId) {
        // Same row lock as the purge: a cancel either lands before the purge re-checks the schedule, or after the
        // account is gone.
        Profile profile = profiles.findByIdForUpdate(userId).orElse(null);
        if (profile == null || !profile.deletionScheduled()) {
            throw new DeletionNotScheduledException("No deletion is scheduled");
        }
        profiles.save(withSchedule(profile, null));
    }

    private static Profile withSchedule(Profile p, Instant when) {
        return new Profile(p.id(), p.email(), p.displayName(), p.phone(), p.createdAt(), when);
    }
}
