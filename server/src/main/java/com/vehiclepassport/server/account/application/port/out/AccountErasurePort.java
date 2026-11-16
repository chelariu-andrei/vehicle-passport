package com.vehiclepassport.server.account.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Removes what the account feature itself stores about a user. Every operation is safe to repeat. */
public interface AccountErasurePort {

    /** Users whose scheduled deletion date is not after {@code now}. */
    List<UUID> findDue(Instant now);

    /** Detaches the user's consent history from their id and keeps it under {@code subjectHash}. */
    void anonymiseConsents(UUID userId, String subjectHash);

    void detachSupportReports(UUID userId);

    void deleteSettings(UUID userId);

    void deleteProfile(UUID userId);
}
