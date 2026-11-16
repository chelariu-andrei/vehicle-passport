package com.vehiclepassport.server.account.application.port.out;

import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Append-only store of consent events. There is deliberately no update or delete. */
public interface ConsentPort {

    void append(List<ConsentRecord> records);

    Optional<ConsentRecord> latest(UUID userId, ConsentType type);

    /** Newest first. */
    List<ConsentRecord> history(UUID userId);
}
