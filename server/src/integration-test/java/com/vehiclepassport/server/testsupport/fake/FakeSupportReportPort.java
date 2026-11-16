package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeSupportReportPort implements SupportReportPort, Resettable {

    private final List<SupportReport> store = new ArrayList<>();

    @Override
    public synchronized void save(UUID id, UUID userId, SupportReport report, Instant createdAt) {
        store.add(report);
    }

    public synchronized List<SupportReport> saved() {
        return List.copyOf(store);
    }

    @Override
    public synchronized void reset() {
        store.clear();
    }
}
