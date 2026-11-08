package com.vehiclepassport.server.vehicle.application.port.out;

import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VehicleRepositoryPort {

    Optional<Vehicle> findByVin(Vin vin);

    List<Vehicle> findByVins(Collection<Vin> vins);

    void save(Vehicle vehicle);
}
