package com.vehiclepassport.server.fuel.application.service;

import com.vehiclepassport.server.fuel.application.port.in.AddFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.DeleteFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryPage;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryView;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesUseCase;
import com.vehiclepassport.server.fuel.application.port.in.UpdateFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.fuel.application.port.out.ClockPort;
import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.application.port.out.OdometerCheckPort;
import com.vehiclepassport.server.fuel.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.fuel.application.port.out.VehicleFuelPort;
import com.vehiclepassport.server.fuel.domain.exception.FuelEntryNotFoundException;
import com.vehiclepassport.server.fuel.domain.exception.OdometerInconsistentException;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionCalculator;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionSegment;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.OdometerPolicy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class FuelEntryService implements AddFuelEntryUseCase, UpdateFuelEntryUseCase, DeleteFuelEntryUseCase,
        ListFuelEntriesUseCase {

    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final FuelEntryRepositoryPort entries;
    private final ActiveOwnerPort owners;
    private final OdometerCheckPort odometer;
    private final VehicleFuelPort vehicles;
    private final ClockPort clock;

    @Inject
    public FuelEntryService(FuelEntryRepositoryPort entries, ActiveOwnerPort owners, OdometerCheckPort odometer,
            VehicleFuelPort vehicles, ClockPort clock) {
        this.entries = entries;
        this.owners = owners;
        this.odometer = odometer;
        this.vehicles = vehicles;
        this.clock = clock;
    }

    @Override
    @Transactional
    public FuelEntryView add(FuelEntryCommand c) {
        OwnedPeriod owned = owners.assertActiveOwner(c.vin(), c.userId());
        entries.lockVin(owned.vin());
        FuelEntry entry = build(c, owned, UUID.randomUUID(), c.userId(), clock.now());
        return write(entry, owned);
    }

    @Override
    @Transactional
    public FuelEntryView update(FuelEntryCommand c) {
        OwnedPeriod owned = owners.assertActiveOwner(c.vin(), c.userId());
        entries.lockVin(owned.vin());
        FuelEntry current = load(owned, c.entryId());
        // A full replace keeps identity, author and creation time (the creation time breaks same-day ties).
        FuelEntry entry = build(c, owned, current.id(), current.createdBy(), current.createdAt());
        return write(entry, owned);
    }

    @Override
    @Transactional
    public void delete(UUID userId, String vin, UUID entryId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        entries.lockVin(owned.vin());
        FuelEntry current = load(owned, entryId);
        entries.softDelete(current.id(), clock.now());
    }

    @Override
    @Transactional
    public FuelEntryPage list(UUID userId, String vin, String cursor, int limit) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        int size = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
        FuelEntryRepositoryPort.Page page = entries.page(owned.vin(), owned.periodId(), cursor, size);
        Map<UUID, BigDecimal> consumption = consumptionById(entries.all(owned.vin(), owned.periodId()));
        return new FuelEntryPage(page.items().stream().map(e -> view(e, consumption.get(e.id()))).toList(),
                page.nextCursor());
    }

    private FuelEntry build(FuelEntryCommand c, OwnedPeriod owned, UUID id, UUID createdBy, Instant createdAt) {
        return FuelEntry.create(id, owned.vin(), owned.periodId(), createdBy, c.date(), c.odometerKm(),
                c.fuelType(), c.quantity(), c.total(), c.currency(), c.grade(), c.chargeType(), c.station(),
                c.note(), c.fullTank(), c.missedPrevious(), vehicles.fuelOf(owned.vin(), c.userId()), clock.today(),
                createdAt);
    }

    private FuelEntry load(OwnedPeriod owned, UUID entryId) {
        if (entryId == null) {
            throw new FuelEntryNotFoundException("Fuel entry not found");
        }
        return entries.find(owned.vin(), owned.periodId(), entryId)
                .orElseThrow(() -> new FuelEntryNotFoundException("Fuel entry " + entryId + " not found"));
    }

    /** Checks the reading against the other entries of the period and the event history, then saves. */
    private FuelEntryView write(FuelEntry entry, OwnedPeriod owned) {
        List<FuelEntry> others = entries.all(owned.vin(), owned.periodId()).stream()
                .filter(e -> !e.id().equals(entry.id())).toList();
        checkNeighbours(entry, others);
        if (!odometer.isConsistent(owned.vin(), entry.date(), entry.odometerKm())) {
            throw new OdometerInconsistentException(
                    "Odometer " + entry.odometerKm() + " km does not fit the recorded history of the vehicle");
        }
        entries.save(entry);
        List<FuelEntry> after = new ArrayList<>(others);
        after.add(entry);
        return view(entry, consumptionById(after).get(entry.id()));
    }

    /**
     * The odometer is car-wide, so every fuel type counts. Neighbours are decided by date: the highest reading
     * dated before and the lowest dated after. Entries of the same day do not constrain each other, because the
     * chronological order sorts them by km within the day.
     */
    private static void checkNeighbours(FuelEntry entry, List<FuelEntry> others) {
        Integer previous = null;
        Integer next = null;
        for (FuelEntry o : others) {
            if (o.date().isBefore(entry.date())) {
                previous = previous == null ? o.odometerKm() : Math.max(previous, o.odometerKm());
            } else if (o.date().isAfter(entry.date())) {
                next = next == null ? o.odometerKm() : Math.min(next, o.odometerKm());
            }
        }
        OdometerPolicy.check(previous, entry.odometerKm(), next);
    }

    /** Consumption of every closing fill-up of an included segment, per fuel type. */
    static Map<UUID, BigDecimal> consumptionById(List<FuelEntry> all) {
        Map<UUID, BigDecimal> out = new HashMap<>();
        Map<FuelEntryType, List<FuelEntry>> byType = all.stream()
                .collect(Collectors.groupingBy(FuelEntry::fuelType));
        for (List<FuelEntry> ofType : byType.values()) {
            for (ConsumptionSegment s : ConsumptionCalculator.calculate(ofType).segments()) {
                out.put(s.closingEntryId(), s.per100km());
            }
        }
        return out;
    }

    static FuelEntryView view(FuelEntry e, BigDecimal consumption) {
        return new FuelEntryView(e.id(), e.date(), e.odometerKm(), e.fuelType(), e.quantity(), e.fuelType().unit(),
                e.total(), e.unitPrice(), e.currency(), e.fullTank(), e.missedPrevious(), e.grade(), e.chargeType(),
                e.station(), e.note(), consumption);
    }
}
