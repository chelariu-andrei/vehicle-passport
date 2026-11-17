package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.domain.exception.InvalidFuelEntryException;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * In-memory twin of {@code FuelEntryPanacheRepository}: the same orders, the same cursor text and the same refusal
 * of a malformed cursor. Ids are compared as lowercase text, the order Postgres gives the uuid column.
 */
@Alternative
@ApplicationScoped
public class FakeFuelEntryRepository implements FuelEntryRepositoryPort, Resettable {

    private static final Comparator<FuelEntry> CHRONOLOGICAL = Comparator.comparing(FuelEntry::date)
            .thenComparingInt(FuelEntry::odometerKm)
            .thenComparing(FuelEntry::createdAt)
            .thenComparing(e -> e.id().toString());
    private static final Comparator<FuelEntry> NEWEST_FIRST = Comparator.comparing(FuelEntry::date)
            .thenComparingInt(FuelEntry::odometerKm)
            .thenComparing(e -> e.id().toString())
            .reversed();

    private final Map<UUID, FuelEntry> store = new LinkedHashMap<>();
    private final Set<UUID> deleted = new HashSet<>();

    @Override
    public void lockVin(String vin) {
        // single-threaded in tests
    }

    @Override
    public synchronized FuelEntry save(FuelEntry entry) {
        store.put(entry.id(), entry);
        return entry;
    }

    @Override
    public synchronized Optional<FuelEntry> find(String vin, UUID periodId, UUID id) {
        return live(vin, periodId).filter(e -> e.id().equals(id)).findFirst();
    }

    @Override
    public synchronized List<FuelEntry> all(String vin, UUID periodId) {
        return live(vin, periodId).sorted(CHRONOLOGICAL).toList();
    }

    @Override
    public synchronized Page page(String vin, UUID periodId, String cursor, int limit) {
        FuelEntry after = cursor == null || cursor.isBlank() ? null : decode(cursor);
        List<FuelEntry> fetched = live(vin, periodId)
                .filter(e -> after == null || NEWEST_FIRST.compare(e, after) > 0)
                .sorted(NEWEST_FIRST).limit(limit + 1L).toList();
        if (fetched.size() <= limit) {
            return new Page(fetched, null);
        }
        List<FuelEntry> window = new ArrayList<>(fetched.subList(0, limit));
        FuelEntry last = window.get(limit - 1);
        String raw = last.date() + "|" + last.odometerKm() + "|" + last.id();
        return new Page(window,
                Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8)));
    }

    @Override
    public synchronized void softDelete(UUID id, Instant at) {
        if (store.containsKey(id)) {
            deleted.add(id);
        }
    }

    @Override
    public synchronized void reset() {
        store.clear();
        deleted.clear();
    }

    private Stream<FuelEntry> live(String vin, UUID periodId) {
        return store.values().stream()
                .filter(e -> !deleted.contains(e.id()) && e.vin().equals(vin) && e.periodId().equals(periodId));
    }

    /** A probe entry carrying only the cursor's sort key. */
    private static FuelEntry decode(String cursor) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", -1);
            if (parts.length != 3) {
                throw new IllegalArgumentException("expected 3 parts");
            }
            return new FuelEntry(UUID.fromString(parts[2]), null, null, null, LocalDate.parse(parts[0]),
                    Integer.parseInt(parts[1]), null, null, null, null, null, null, null, null, null, false, false,
                    null);
        } catch (RuntimeException e) {
            throw InvalidFuelEntryException.validation("Malformed cursor");
        }
    }
}
