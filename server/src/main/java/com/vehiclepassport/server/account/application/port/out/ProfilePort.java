package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.Profile;
import java.util.Optional;
import java.util.UUID;

public interface ProfilePort {

    /** INSERT ... ON CONFLICT DO NOTHING, then returns the stored row (the candidate or the one that won). */
    Profile upsertIfAbsent(Profile profile);

    Optional<Profile> findById(UUID id);

    /** Like {@link #findById} but holds the row lock until the transaction ends (the purge takes the same lock). */
    Optional<Profile> findByIdForUpdate(UUID id);

    void save(Profile profile);
}
