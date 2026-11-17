package com.vehiclepassport.server.fuel.application.service;

import com.vehiclepassport.server.fuel.application.port.in.DetachOwnerUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryExportView;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesByCreatorUseCase;
import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionCalculator;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** The account hooks: purge and export of a person's fill-ups. */
@ApplicationScoped
public class FuelOwnerService implements DetachOwnerUseCase, ListFuelEntriesByCreatorUseCase {

    private final FuelEntryRepositoryPort entries;

    @Inject
    public FuelOwnerService(FuelEntryRepositoryPort entries) {
        this.entries = entries;
    }

    @Override
    @Transactional
    public void detach(UUID ownerId, UUID tombstone) {
        entries.deleteByCreator(ownerId);
    }

    /**
     * Consumption is computed per car and ownership period, as the owner saw it. Only the period's owner writes
     * fill-ups, so the person's own entries of a period are all the entries of that period.
     */
    @Override
    @Transactional
    public List<FuelEntryExportView> listByCreator(UUID userId) {
        List<FuelEntry> mine = new ArrayList<>(entries.allByCreator(userId));
        Map<String, List<FuelEntry>> byPeriod = mine.stream()
                .collect(Collectors.groupingBy(e -> e.vin() + "|" + e.periodId()));
        Map<UUID, BigDecimal> consumption = new HashMap<>();
        byPeriod.values().forEach(of -> consumption.putAll(FuelEntryService.consumptionById(of)));
        mine.sort(Comparator.comparing(FuelEntry::vin).thenComparing(ConsumptionCalculator.CHRONOLOGICAL));
        return mine.stream().map(e -> export(e, consumption.get(e.id()))).toList();
    }

    private static FuelEntryExportView export(FuelEntry e, BigDecimal consumption) {
        return new FuelEntryExportView(e.vin(), e.id(), e.date(), e.odometerKm(), e.fuelType().name(), e.quantity(),
                e.fuelType().unit().name(), e.total(), e.unitPrice(), e.currency(), e.fullTank(), e.missedPrevious(),
                e.grade() == null ? null : e.grade().name(), e.chargeType() == null ? null : e.chargeType().name(),
                e.station(), e.note(), consumption);
    }
}
