package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.OwnedData;
import com.vehiclepassport.server.account.domain.model.Settings;
import java.time.Instant;
import java.util.List;

public record AccountExport(Instant exportedAt, Me profile, Settings settings, List<ConsentRecord> consents,
        OwnedData data) {
}
