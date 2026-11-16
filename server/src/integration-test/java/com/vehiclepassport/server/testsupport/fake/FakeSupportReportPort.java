package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.model.SubmittedSupportReport;
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

    private record Stored(UUID userId, SupportReport report, Instant createdAt) {
    }

    private final List<Stored> store = new ArrayList<>();

    @Override
    public synchronized void save(UUID id, UUID userId, SupportReport report, Instant createdAt) {
        store.add(new Stored(userId, report, createdAt));
    }

    @Override
    public synchronized List<SubmittedSupportReport> findByUser(UUID userId) {
        return store.stream().filter(s -> userId.equals(s.userId()))
                .map(s -> new SubmittedSupportReport(s.report().kind(), s.report().message(),
                        s.report().diagnostics(), s.createdAt()))
                .toList();
    }

    public synchronized List<SupportReport> saved() {
        return store.stream().map(Stored::report).toList();
    }

    @Override
    public synchronized void reset() {
        store.clear();
    }
}
