package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.Profile;
import java.util.Optional;
import java.util.UUID;

public interface ProfilePort {

    /** INSERT ... ON CONFLICT DO NOTHING, then returns the stored row (the candidate or the one that won). */
    Profile upsertIfAbsent(Profile profile);

    Optional<Profile> findById(UUID id);

    void save(Profile profile);
}
