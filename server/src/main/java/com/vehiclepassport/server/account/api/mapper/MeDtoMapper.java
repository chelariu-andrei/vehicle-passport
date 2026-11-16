package com.vehiclepassport.server.account.api.mapper;

import com.vehiclepassport.server.account.api.dto.MeResponse;
import com.vehiclepassport.server.account.api.dto.ProfilePatchRequest;
import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.in.ProfileChange;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.Profile;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class MeDtoMapper {

    /** An explicit null clears (empty string); an absent key is left unchanged (empty Optional). */
    public ProfileChange toChange(ProfilePatchRequest r) {
        return new ProfileChange(field(r.displayNameGiven(), r.displayName()), field(r.phoneGiven(), r.phone()));
    }

    private static Optional<String> field(boolean given, String value) {
        if (!given) {
            return Optional.empty();
        }
        return Optional.of(value == null ? "" : value);
    }

    public MeResponse toResponse(Me me) {
        Profile p = me.profile();
        return new MeResponse(p.id(), p.email(), me.emailVerified(),
                p.displayName() == null ? null : p.displayName().value(),
                p.phone() == null ? null : p.phone().value(),
                p.createdAt(),
                new MeResponse.Stats(me.stats().vehicles(), me.stats().events(), me.stats().passports()),
                p.deletionScheduled() ? new MeResponse.Deletion(p.deletionScheduledFor()) : null,
                consent(me.consent()));
    }

    private static MeResponse.Consent consent(ConsentStatus c) {
        return new MeResponse.Consent(c.required(),
                new MeResponse.VersionState(c.terms().currentVersion(), c.terms().acceptedVersion()),
                new MeResponse.VersionState(c.privacy().currentVersion(), c.privacy().acceptedVersion()),
                c.marketing(), c.analytics());
    }
}
