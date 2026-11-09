package com.vehiclepassport.server.vehicle.infrastructure.persistence.repository;

import com.vehiclepassport.server.vehicle.application.port.out.VehicleRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.ConcurrentOwnershipChangeException;
import com.vehiclepassport.server.vehicle.domain.model.Fuel;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import com.vehiclepassport.server.vehicle.infrastructure.persistence.entity.VehicleEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.PersistenceException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class VehiclePanacheRepository implements VehicleRepositoryPort, PanacheRepositoryBase<VehicleEntity, String> {

    @Override
    public Optional<Vehicle> findByVin(Vin vin) {
        return Optional.ofNullable(findById(vin.value())).map(VehiclePanacheRepository::toDomain);
    }

    @Override
    public List<Vehicle> findByVins(Collection<Vin> vins) {
        if (vins.isEmpty()) {
            return List.of();
        }
        List<String> values = vins.stream().map(Vin::value).toList();
        return list("vin in ?1 order by vin", values).stream().map(VehiclePanacheRepository::toDomain).toList();
    }

    @Override
    public void save(Vehicle vehicle) {
        VehicleEntity entity = findById(vehicle.vin().value());
        if (entity == null) {
            entity = new VehicleEntity();
            entity.vin = vehicle.vin().value();
        }
        entity.make = vehicle.make();
        entity.model = vehicle.model();
        entity.engine = vehicle.engine();
        entity.year = vehicle.year();
        entity.fuel = vehicle.fuel().name();
        try {
            persist(entity);
            flush();
        } catch (PersistenceException e) {
            if (UniqueViolations.isUniqueViolation(e)) {
                throw new ConcurrentOwnershipChangeException("The vehicle was registered concurrently; retry");
            }
            throw e;
        }
    }

    private static Vehicle toDomain(VehicleEntity e) {
        return new Vehicle(new Vin(e.vin), e.make, e.model, e.engine, e.year, Fuel.parse(e.fuel));
    }
}
