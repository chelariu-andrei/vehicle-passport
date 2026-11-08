package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.testsupport.Resettable;
import com.vehiclepassport.server.vehicle.application.port.out.VehicleRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Alternative
@ApplicationScoped
public class FakeVehicleRepository implements VehicleRepositoryPort, Resettable {

    private final Map<Vin, Vehicle> store = new LinkedHashMap<>();

    @Override
    public Optional<Vehicle> findByVin(Vin vin) {
        return Optional.ofNullable(store.get(vin));
    }

    @Override
    public List<Vehicle> findByVins(Collection<Vin> vins) {
        return vins.stream().map(store::get).filter(Objects::nonNull).toList();
    }

    @Override
    public void save(Vehicle vehicle) {
        store.put(vehicle.vin(), vehicle);
    }

    @Override
    public void reset() {
        store.clear();
    }
}
