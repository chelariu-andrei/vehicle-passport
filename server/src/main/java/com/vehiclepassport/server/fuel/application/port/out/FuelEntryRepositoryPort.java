package com.vehiclepassport.server.fuel.application.port.out;

import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Soft-deleted entries are invisible to every read. Reads are always scoped to one ownership period. */
public interface FuelEntryRepositoryPort {

    /** Serialises writes on the VIN's fuel entries until the transaction ends, so odometer checks see fresh data. */
    void lockVin(String vin);

    /** Inserts or replaces by id. */
    FuelEntry save(FuelEntry entry);

    Optional<FuelEntry> find(String vin, UUID periodId, UUID id);

    /** Every entry of the period, ordered by (entry_date, odometer_km, created_at). */
    List<FuelEntry> all(String vin, UUID periodId);

    /**
     * Newest first, at most {@code limit}, strictly after the opaque {@code cursor} (from the start when null).
     * A malformed cursor throws {@code InvalidFuelEntryException.validation}.
     */
    Page page(String vin, UUID periodId, String cursor, int limit);

    void softDelete(UUID id, Instant at);

    /** Every non-deleted entry the user created, on any car and in any period; the order is unspecified. */
    List<FuelEntry> allByCreator(UUID createdBy);

    /** Removes every row the user created, soft-deleted ones included (account purge). */
    void deleteByCreator(UUID createdBy);

    /** {@code nextCursor} is null on the last page. */
    record Page(List<FuelEntry> items, String nextCursor) {
        public Page {
            items = List.copyOf(items);
        }
    }
}
