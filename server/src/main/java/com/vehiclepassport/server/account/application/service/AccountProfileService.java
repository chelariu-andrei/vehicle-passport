package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.in.ProfileChange;
import com.vehiclepassport.server.account.application.port.in.UpdateProfileUseCase;
import com.vehiclepassport.server.account.application.port.out.ConsentStatusReaderPort;
import com.vehiclepassport.server.account.application.port.out.OwnerStatsPort;
import com.vehiclepassport.server.account.application.port.out.ProfilePort;
import com.vehiclepassport.server.account.domain.model.DisplayName;
import com.vehiclepassport.server.account.domain.model.PhoneNumber;
import com.vehiclepassport.server.account.domain.model.Profile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class AccountProfileService implements GetMeUseCase, UpdateProfileUseCase {

    private final ProfilePort profiles;
    private final OwnerStatsPort stats;
    private final ConsentStatusReaderPort consent;
    private final Clock clock;

    @Inject
    public AccountProfileService(ProfilePort profiles, OwnerStatsPort stats, ConsentStatusReaderPort consent,
            Clock clock) {
        this.profiles = profiles;
        this.stats = stats;
        this.consent = consent;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Me get(UUID userId, String emailClaim, boolean emailVerified) {
        Profile profile = provision(userId, emailClaim);
        if (emailClaim != null && !emailClaim.isBlank() && !Objects.equals(profile.email(), emailClaim)) {
            profile = withEmail(profile, emailClaim);
            profiles.save(profile);
        }
        return me(profile, emailVerified);
    }

    @Override
    @Transactional
    public Me update(UUID userId, ProfileChange change) {
        Profile profile = provision(userId, null);
        DisplayName name = profile.displayName();
        PhoneNumber phone = profile.phone();
        if (change.displayName().isPresent()) {
            String raw = change.displayName().get();
            name = raw.isEmpty() ? null : DisplayName.of(raw);
        }
        if (change.phone().isPresent()) {
            String raw = change.phone().get();
            phone = raw.isEmpty() ? null : PhoneNumber.of(raw);
        }
        Profile updated = new Profile(profile.id(), profile.email(), name, phone, profile.createdAt(),
                profile.deletionScheduledFor());
        profiles.save(updated);
        return me(updated, false);
    }

    private Profile provision(UUID userId, String emailClaim) {
        String email = emailClaim == null || emailClaim.isBlank() ? null : emailClaim;
        return profiles.upsertIfAbsent(new Profile(userId, email, null, null, clock.instant(), null));
    }

    private static Profile withEmail(Profile p, String email) {
        return new Profile(p.id(), email, p.displayName(), p.phone(), p.createdAt(), p.deletionScheduledFor());
    }

    private Me me(Profile profile, boolean emailVerified) {
        return new Me(profile, emailVerified, stats.statsFor(profile.id()), consent.read(profile.id()));
    }
}
