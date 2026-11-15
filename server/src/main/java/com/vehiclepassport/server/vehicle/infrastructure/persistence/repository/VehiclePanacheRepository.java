package com.vehiclepassport.server.vehicle.infrastructure.persistence.repository;

import com.vehiclepassport.server.vehicle.application.port.out.VehicleRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.ConcurrentOwnershipChangeException;
import com.vehiclepassport.server.vehicle.domain.model.Appearance;
import com.vehiclepassport.server.vehicle.domain.model.BodyType;
import com.vehiclepassport.server.vehicle.domain.model.Fuel;
import com.vehiclepassport.server.vehicle.domain.model.GlassTint;
import com.vehiclepassport.server.vehicle.domain.model.PaintColor;
import com.vehiclepassport.server.vehicle.domain.model.PaintFinish;
import com.vehiclepassport.server.vehicle.domain.model.Plate;
import com.vehiclepassport.server.vehicle.domain.model.RimColor;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import com.vehiclepassport.server.vehicle.domain.model.WheelStyle;
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
        entity.plate = vehicle.plate() == null ? null : vehicle.plate().value();
        Appearance a = vehicle.appearance();
        entity.bodyType = a == null ? null : name(a.bodyType());
        entity.paintColor = a == null ? null : name(a.color());
        entity.paintHex = a == null ? null : a.colorHex();
        entity.paintFinish = a == null ? null : name(a.finish());
        entity.wheelStyle = a == null ? null : name(a.wheels());
        entity.rimColor = a == null ? null : name(a.rimColor());
        entity.glassTint = a == null ? null : name(a.glassTint());
        entity.contrastRoof = a == null ? null : a.contrastRoof();
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
        Appearance look = new Appearance(BodyType.parse(e.bodyType), PaintColor.parse(e.paintColor), e.paintHex,
                PaintFinish.parse(e.paintFinish), WheelStyle.parse(e.wheelStyle), RimColor.parse(e.rimColor),
                GlassTint.parse(e.glassTint), e.contrastRoof);
        return new Vehicle(new Vin(e.vin), e.make, e.model, e.engine, e.year, Fuel.parse(e.fuel),
                Plate.ofNullable(e.plate), look);
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
