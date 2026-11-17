package com.vehiclepassport.server.fuel.application.service;

import com.vehiclepassport.server.fuel.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.fuel.application.port.out.ClockPort;
import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.application.port.out.OdometerCheckPort;
import com.vehiclepassport.server.fuel.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.fuel.application.port.out.VehicleFuelPort;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionCalculator;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.VehicleFuel;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** In-memory port fakes for the fuel service tests; no Quarkus. */
final class FuelFakes {

    static final String VIN = "WVWZZZ1JZXW000001";

    private FuelFakes() {
    }

    static final class VehicleNotFound extends DomainException {
        VehicleNotFound(String vin) {
            super(ErrorKind.NOT_FOUND, "vehicle-not-found", "Vehicle " + vin + " not found");
        }
    }

    static final class Repo implements FuelEntryRepositoryPort {
        final Map<UUID, FuelEntry> rows = new LinkedHashMap<>();
        final Map<UUID, Instant> deleted = new HashMap<>();

        @Override
        public void lockVin(String vin) {
        }

        @Override
        public FuelEntry save(FuelEntry entry) {
            rows.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<FuelEntry> find(String vin, UUID periodId, UUID id) {
            return Optional.ofNullable(rows.get(id)).filter(e -> !deleted.containsKey(e.id()))
                    .filter(e -> e.vin().equals(vin) && e.periodId().equals(periodId));
        }

        @Override
        public List<FuelEntry> all(String vin, UUID periodId) {
            return rows.values().stream().filter(e -> !deleted.containsKey(e.id()))
                    .filter(e -> e.vin().equals(vin) && e.periodId().equals(periodId))
                    .sorted(ConsumptionCalculator.CHRONOLOGICAL).toList();
        }

        /** Cursor is the index of the next row in newest-first order. */
        @Override
        public Page page(String vin, UUID periodId, String cursor, int limit) {
            List<FuelEntry> newest = new ArrayList<>(all(vin, periodId));
            java.util.Collections.reverse(newest);
            int from = cursor == null ? 0 : Integer.parseInt(cursor);
            int to = Math.min(newest.size(), from + limit);
            return new Page(newest.subList(from, to), to < newest.size() ? String.valueOf(to) : null);
        }

        @Override
        public void softDelete(UUID id, Instant at) {
            deleted.put(id, at);
        }
    }

    static final class Owners implements ActiveOwnerPort {
        final Map<UUID, UUID> periodByOwner = new HashMap<>();

        UUID own(UUID owner) {
            UUID period = UUID.randomUUID();
            periodByOwner.put(owner, period);
            return period;
        }

        @Override
        public OwnedPeriod assertActiveOwner(String vin, UUID userId) {
            UUID period = periodByOwner.get(userId);
            if (period == null || !VIN.equals(vin)) {
                throw new VehicleNotFound(vin);
            }
            return new OwnedPeriod(VIN, period);
        }
    }

    static final class Odometer implements OdometerCheckPort {
        boolean consistent = true;

        @Override
        public boolean isConsistent(String vin, LocalDate date, int km) {
            return consistent;
        }
    }

    static final class Vehicles implements VehicleFuelPort {
        VehicleFuel fuel = VehicleFuel.DIESEL;

        @Override
        public VehicleFuel fuelOf(String vin, UUID userId) {
            return fuel;
        }
    }

    static final class FixedClock implements ClockPort {
        LocalDate today = LocalDate.of(2026, 11, 17);
        private int tick;

        @Override
        public LocalDate today() {
            return today;
        }

        /** Strictly increasing, so creation order is deterministic. */
        @Override
        public Instant now() {
            return Instant.parse("2026-11-17T10:00:00Z").plusSeconds(tick++);
        }
    }
}
