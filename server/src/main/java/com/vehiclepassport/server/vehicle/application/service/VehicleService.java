package com.vehiclepassport.server.vehicle.application.service;

import com.vehiclepassport.server.vehicle.application.port.in.ActiveOwnership;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.ListMyVehiclesUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.application.port.out.VehicleRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.AlreadyOwnerException;
import com.vehiclepassport.server.vehicle.domain.exception.VehicleNotFoundException;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class VehicleService implements RegisterVehicleUseCase, ListMyVehiclesUseCase, GetVehicleUseCase,
        UpdateVehicleUseCase, ReleaseVehicleUseCase, AssertActiveOwnerUseCase {

    private final VehicleRepositoryPort vehicles;
    private final OwnershipRepositoryPort ownerships;
    private final Clock clock;

    @Inject
    public VehicleService(VehicleRepositoryPort vehicles, OwnershipRepositoryPort ownerships, Clock clock) {
        this.vehicles = vehicles;
        this.ownerships = ownerships;
        this.clock = clock;
    }

    @Override
    @Transactional
    public RegistrationResult register(RegisterVehicleCommand c) {
        Vin vin = Vin.of(c.vin());
        Vehicle candidate = Vehicle.of(vin, c.make(), c.model(), c.engine(), c.year(), c.fuel(), clock);
        ownerships.lockVin(vin);
        Optional<OwnershipPeriod> open = ownerships.findOpen(vin);
        if (open.isPresent()) {
            if (open.get().ownerId().equals(c.userId())) {
                throw new AlreadyOwnerException("You already own vehicle " + vin.value());
            }
            // Stub until the claim half lands: report a claim without persisting anything.
            return new ClaimFiled(UUID.randomUUID());
        }
        // A VIN with history keeps its recorded data; only a brand-new VIN takes the submitted data.
        Vehicle vehicle = vehicles.findByVin(vin).orElse(null);
        if (vehicle == null) {
            vehicle = candidate;
            vehicles.save(vehicle);
        }
        ownerships.save(new OwnershipPeriod(UUID.randomUUID(), vin, c.userId(), clock.instant(), null));
        return new Registered(view(vehicle));
    }

    @Override
    public List<VehicleView> list(UUID userId) {
        List<Vin> vins = ownerships.findOpenByOwner(userId).stream().map(OwnershipPeriod::vin).toList();
        return vehicles.findByVins(vins).stream().map(VehicleService::view).toList();
    }

    @Override
    public VehicleView get(String vin, UUID userId) {
        Vin parsed = Vin.of(vin);
        requireOwner(parsed, userId);
        return vehicles.findByVin(parsed).map(VehicleService::view).orElseThrow(() -> notFound(parsed));
    }

    @Override
    @Transactional
    public VehicleView update(UpdateVehicleCommand c) {
        Vin vin = Vin.of(c.vin());
        ownerships.lockVin(vin);
        requireOwner(vin, c.userId());
        Vehicle vehicle = Vehicle.of(vin, c.make(), c.model(), c.engine(), c.year(), c.fuel(), clock);
        vehicles.save(vehicle);
        return view(vehicle);
    }

    @Override
    @Transactional
    public void release(String vin, UUID userId) {
        Vin parsed = Vin.of(vin);
        ownerships.lockVin(parsed);
        OwnershipPeriod period = requireOwner(parsed, userId);
        ownerships.save(period.close(clock.instant()));
    }

    @Override
    public ActiveOwnership assertActiveOwner(String vin, UUID userId) {
        return new ActiveOwnership(requireOwner(Vin.of(vin), userId).id());
    }

    @Override
    public boolean isPeriodOpen(UUID periodId) {
        return ownerships.findById(periodId).map(OwnershipPeriod::isOpen).orElse(false);
    }

    private OwnershipPeriod requireOwner(Vin vin, UUID userId) {
        return ownerships.findOpen(vin)
                .filter(p -> p.ownerId().equals(userId))
                .orElseThrow(() -> notFound(vin));
    }

    private static VehicleNotFoundException notFound(Vin vin) {
        return new VehicleNotFoundException("Vehicle " + vin.value() + " not found");
    }

    private static VehicleView view(Vehicle v) {
        return new VehicleView(v.vin().value(), v.make(), v.model(), v.engine(), v.year(), v.fuel().name());
    }
}
