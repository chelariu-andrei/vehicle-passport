package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.ConsentPort;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeConsentPort implements ConsentPort, Resettable {

    private final List<ConsentRecord> store = new ArrayList<>();

    @Override
    public synchronized void append(List<ConsentRecord> records) {
        store.addAll(records);
    }

    @Override
    public synchronized Optional<ConsentRecord> latest(UUID userId, ConsentType type) {
        return store.stream().filter(r -> userId.equals(r.userId()) && r.type() == type)
                .max(Comparator.comparing(ConsentRecord::createdAt));
    }

    @Override
    public synchronized List<ConsentRecord> history(UUID userId) {
        return store.stream().filter(r -> userId.equals(r.userId()))
                .sorted(Comparator.comparing(ConsentRecord::createdAt).reversed()).toList();
    }

    @Override
    public synchronized void reset() {
        store.clear();
    }
}
