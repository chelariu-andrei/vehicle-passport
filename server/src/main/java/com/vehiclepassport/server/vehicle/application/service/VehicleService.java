package com.vehiclepassport.server.vehicle.application.service;

import com.vehiclepassport.server.vehicle.application.port.in.DetachOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.ActiveOwnership;
import com.vehiclepassport.server.vehicle.application.port.in.AppearanceView;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.CountOwnedByOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.FileOwnershipClaimUseCase;
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
import com.vehiclepassport.server.vehicle.domain.model.Appearance;
import com.vehiclepassport.server.vehicle.domain.model.BodyType;
import com.vehiclepassport.server.vehicle.domain.model.GlassTint;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.PaintColor;
import com.vehiclepassport.server.vehicle.domain.model.PaintFinish;
import com.vehiclepassport.server.vehicle.domain.model.Plate;
import com.vehiclepassport.server.vehicle.domain.model.RimColor;
import com.vehiclepassport.server.vehicle.domain.model.Vehicle;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import com.vehiclepassport.server.vehicle.domain.model.WheelStyle;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class VehicleService implements RegisterVehicleUseCase, ListMyVehiclesUseCase, GetVehicleUseCase,
        UpdateVehicleUseCase, ReleaseVehicleUseCase, AssertActiveOwnerUseCase, CountOwnedByOwnerUseCase, DetachOwnerUseCase {

    private final VehicleRepositoryPort vehicles;
    private final OwnershipRepositoryPort ownerships;
    private final FileOwnershipClaimUseCase claims;
    private final Clock clock;

    @Inject
    public VehicleService(VehicleRepositoryPort vehicles, OwnershipRepositoryPort ownerships,
                          FileOwnershipClaimUseCase claims, Clock clock) {
        this.vehicles = vehicles;
        this.ownerships = ownerships;
        this.claims = claims;
        this.clock = clock;
    }

    @Override
    @Transactional
    public RegistrationResult register(RegisterVehicleCommand c) {
        Vin vin = Vin.of(c.vin());
        Vehicle candidate = Vehicle.of(vin, c.make(), c.model(), c.engine(), c.year(), c.fuel(), null, null, clock);
        ownerships.lockVin(vin);
        Optional<OwnershipPeriod> open = ownerships.findOpen(vin);
        if (open.isPresent()) {
            if (open.get().ownerId().equals(c.userId())) {
                throw new AlreadyOwnerException("You already own vehicle " + vin.value());
            }
            FileOwnershipClaimUseCase.FiledClaim filed = claims.file(vin.value(), c.userId());
            return new ClaimFiled(filed.claimId(), filed.filedAt());
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
    @Transactional
    public void detach(UUID ownerId, UUID tombstone) {
        // Each car the leaving owner still holds is released exactly like a sale: plate off, pending claims on it
        // rejected, period closed. Only then are the remaining records pointed at the tombstone.
        Instant now = clock.instant();
        for (OwnershipPeriod open : ownerships.findOpenByOwner(ownerId)) {
            ownerships.lockVin(open.vin());
            ownerships.findOpen(open.vin())
                    .filter(p -> p.ownerId().equals(ownerId))
                    .ifPresent(p -> releasePeriod(p, now));
        }
        ownerships.detachOwner(ownerId, tombstone);
    }

    @Override
    public long count(UUID ownerId) {
        return ownerships.countOpenByOwner(ownerId);
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
        Vehicle current = vehicles.findByVin(vin).orElseThrow(() -> notFound(vin));
        Plate plate = c.plateGiven() ? Plate.ofNullable(c.plate()) : current.plate();
        Appearance appearance = c.appearance() != null ? appearance(c.appearance()) : current.appearance();
        Vehicle vehicle = Vehicle.of(vin, c.make(), c.model(), c.engine(), c.year(), c.fuel(), plate, appearance,
                clock);
        vehicles.save(vehicle);
        return view(vehicle);
    }

    @Override
    @Transactional
    public void release(String vin, UUID userId) {
        Vin parsed = Vin.of(vin);
        ownerships.lockVin(parsed);
        releasePeriod(requireOwner(parsed, userId), clock.instant());
    }

    /** Caller holds the VIN lock. */
    private void releasePeriod(OwnershipPeriod period, Instant now) {
        ownerships.save(period.close(now));
        ownerships.findPendingClaims(period.vin()).forEach(claim -> ownerships.save(claim.reject(now)));
        vehicles.findByVin(period.vin()).ifPresent(v -> vehicles.save(v.withoutPlate()));
    }

    @Override
    public ActiveOwnership assertActiveOwner(String vin, UUID userId) {
        Vin parsed = Vin.of(vin);
        return new ActiveOwnership(requireOwner(parsed, userId).id(), parsed.value());
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
        return new VehicleView(v.vin().value(), v.make(), v.model(), v.engine(), v.year(), v.fuel().name(),
                v.plate() == null ? null : v.plate().value(), view(v.appearance()));
    }

    private static AppearanceView view(Appearance a) {
        return a == null ? null : new AppearanceView(name(a.bodyType()), name(a.color()), a.colorHex(),
                name(a.finish()), name(a.wheels()), name(a.rimColor()), name(a.glassTint()), a.contrastRoof());
    }

    private static Appearance appearance(AppearanceView a) {
        return new Appearance(BodyType.parse(a.bodyType()), PaintColor.parse(a.color()), a.colorHex(),
                PaintFinish.parse(a.finish()), WheelStyle.parse(a.wheels()), RimColor.parse(a.rimColor()),
                GlassTint.parse(a.glassTint()), a.contrastRoof());
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
