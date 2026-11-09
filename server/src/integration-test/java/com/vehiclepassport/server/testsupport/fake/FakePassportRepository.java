package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.passport.application.port.out.PassportRepositoryPort;
import com.vehiclepassport.server.passport.domain.model.Passport;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakePassportRepository implements PassportRepositoryPort, Resettable {

    private final Map<UUID, Passport> store = new LinkedHashMap<>();

    @Override
    public void save(Passport passport) {
        store.put(passport.id(), passport);
    }

    @Override
    public Optional<Passport> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Passport> findByToken(String token) {
        return store.values().stream().filter(p -> p.link().token().equals(token)).findFirst();
    }

    @Override
    public List<Passport> findByCreator(UUID userId) {
        return store.values().stream().filter(p -> p.createdBy().equals(userId)).toList();
    }

    @Override
    public void reset() {
        store.clear();
    }
}
