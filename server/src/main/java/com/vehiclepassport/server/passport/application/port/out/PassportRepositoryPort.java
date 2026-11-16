package com.vehiclepassport.server.passport.application.port.out;

import com.vehiclepassport.server.passport.domain.model.Passport;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PassportRepositoryPort {

    void save(Passport passport);

    Optional<Passport> findById(UUID id);

    Optional<Passport> findByToken(String token);

    List<Passport> findByCreator(UUID userId);

    long countByCreator(UUID userId);

    /** Sets revokedAt on every passport of the creator that is not yet revoked; returns the count. */
    int revokeAllByCreator(UUID userId, java.time.Instant at);
}
