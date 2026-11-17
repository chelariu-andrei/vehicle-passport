package com.vehiclepassport.server.fuel.application.service;

import com.vehiclepassport.server.fuel.application.FuelConfig;
import com.vehiclepassport.server.fuel.application.port.in.FuelStatsView;
import com.vehiclepassport.server.fuel.application.port.in.GetFuelStatsUseCase;
import com.vehiclepassport.server.fuel.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.fuel.application.port.out.ClockPort;
import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.application.port.out.LatestOdometerPort;
import com.vehiclepassport.server.fuel.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.fuel.domain.exception.InvalidFuelEntryException;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionAlert;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionCalculator;
import com.vehiclepassport.server.fuel.domain.model.ConsumptionSegment;
import com.vehiclepassport.server.fuel.domain.model.CostMetrics;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.GradeComparison;
import com.vehiclepassport.server.fuel.domain.model.MonthEstimate;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Loads the ownership period's entries once and runs the pure calculators; nothing is aggregated in SQL.
 *
 * <p>Two choices the spec leaves open:
 * <ul>
 * <li><b>Period boundary.</b> Consumption segments are computed over every entry of the fuel type in the ownership
 * period, then a segment is kept when its closing fill-up falls inside the selected period. A segment opened before
 * the period therefore still counts, and partial fill-ups between the opening tank and the period start keep their
 * quantity. Average, last, alert and grade comparison use only the kept segments.</li>
 * <li><b>Currency.</b> Litres and kWh do not depend on money, so segments use entries of every currency. Everything
 * priced (total, cost per km, monthly, estimate, unit prices, points) and {@code entryCount} use only the entries
 * of the chosen currency; the others are {@code ignoredEntries}.</li>
 * </ul>
 */
@ApplicationScoped
public class FuelStatsService implements GetFuelStatsUseCase {

    private static final int MIN_PER_GRADE = 3;
    private static final Map<String, Integer> PERIOD_MONTHS = Map.of("3m", 3, "6m", 6, "12m", 12);
    private static final String ALL = "all";

    private final FuelEntryRepositoryPort entries;
    private final ActiveOwnerPort owners;
    private final LatestOdometerPort events;
    private final ClockPort clock;
    private final FuelConfig config;

    @Inject
    public FuelStatsService(FuelEntryRepositoryPort entries, ActiveOwnerPort owners, LatestOdometerPort events,
            ClockPort clock, FuelConfig config) {
        this.entries = entries;
        this.owners = owners;
        this.events = events;
        this.clock = clock;
        this.config = config;
    }

    @Override
    @Transactional
    public FuelStatsView stats(UUID userId, String vin, String period) {
        LocalDate today = clock.today();
        LocalDate from = from(period, today);
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        List<FuelEntry> all = entries.all(owned.vin(), owned.periodId());

        List<FuelEntry> inPeriod = all.stream().filter(e -> from == null || !e.date().isBefore(from)).toList();
        String currency = currency(inPeriod);
        List<FuelEntry> priced = inPeriod.stream().filter(e -> e.currency().equals(currency)).toList();

        BigDecimal totalCost = BigDecimal.ZERO.setScale(2);
        for (FuelEntry e : priced) {
            totalCost = totalCost.add(e.total());
        }
        MonthEstimate estimate = CostMetrics.monthEstimate(priced, today);
        return new FuelStatsView(currency, new FuelStatsView.Period(from, today), lastOdometerKm(owned.vin(), all),
                priced.size(), inPeriod.size() - priced.size(), totalCost,
                CostMetrics.costPerKm(priced),
                CostMetrics.monthly(priced).stream().map(m -> new FuelStatsView.MonthCost(m.month(), m.cost(),
                        m.quantity(), m.entries(), m.distanceKm())).toList(),
                new FuelStatsView.MonthEstimate(estimate.month(), estimate.spentSoFar(), estimate.projected()),
                byFuelType(all, priced, from));
    }

    /** Start of the selected period (inclusive), null for {@code all}. */
    private static LocalDate from(String period, LocalDate today) {
        if (ALL.equals(period)) {
            return null;
        }
        Integer months = period == null ? null : PERIOD_MONTHS.get(period);
        if (months == null) {
            throw InvalidFuelEntryException.validation("Period must be one of 3m, 6m, 12m, all");
        }
        return today.minusMonths(months);
    }

    /** Most entries wins; a tie goes to the currency of the most recent entry. Null without entries. */
    private static String currency(List<FuelEntry> inPeriod) {
        Map<String, Integer> counts = new HashMap<>();
        inPeriod.forEach(e -> counts.merge(e.currency(), 1, Integer::sum));
        String best = null;
        int bestCount = 0;
        // Walking newest first and replacing only on a strictly higher count keeps the most recent on a tie.
        List<FuelEntry> newestFirst = new ArrayList<>(inPeriod);
        newestFirst.sort(ConsumptionCalculator.CHRONOLOGICAL.reversed());
        for (FuelEntry e : newestFirst) {
            int c = counts.get(e.currency());
            if (c > bestCount) {
                best = e.currency();
                bestCount = c;
            }
        }
        return best;
    }

    /** Highest reading among events and every fuel entry of the ownership period, whatever the selected period. */
    private Integer lastOdometerKm(String vin, List<FuelEntry> all) {
        Integer fuel = all.stream().map(FuelEntry::odometerKm).max(Integer::compare).orElse(null);
        Integer event = events.latestKm(vin).orElse(null);
        if (fuel == null) {
            return event;
        }
        return event == null ? fuel : Math.max(fuel, event);
    }

    private List<FuelStatsView.FuelTypeStats> byFuelType(List<FuelEntry> all, List<FuelEntry> priced,
            LocalDate from) {
        List<FuelStatsView.FuelTypeStats> out = new ArrayList<>();
        for (FuelEntryType type : FuelEntryType.values()) {
            List<FuelEntry> pricedOfType = priced.stream().filter(e -> e.fuelType() == type).toList();
            if (pricedOfType.isEmpty()) {
                continue;
            }
            List<FuelEntry> allOfType = all.stream().filter(e -> e.fuelType() == type).toList();
            List<ConsumptionSegment> segments = ConsumptionCalculator.calculate(allOfType).segments().stream()
                    .filter(s -> from == null || !s.date().isBefore(from)).toList();
            Map<UUID, BigDecimal> consumption = new HashMap<>();
            segments.forEach(s -> consumption.put(s.closingEntryId(), s.per100km()));

            List<FuelEntry> chronological = new ArrayList<>(pricedOfType);
            chronological.sort(ConsumptionCalculator.CHRONOLOGICAL);
            List<FuelStatsView.Point> points = chronological.stream().map(e -> new FuelStatsView.Point(e.id(),
                    e.date(), e.odometerKm(), e.unitPrice(), consumption.get(e.id()))).toList();

            FuelStatsView.Alert alert = ConsumptionAlert.detect(segments, config.alert().window(),
                            config.alert().minBaseline(), config.alert().thresholdPct())
                    .map(a -> new FuelStatsView.Alert(a.latest(), a.baseline(), a.deltaPct(), a.entryId()))
                    .orElse(null);
            List<FuelStatsView.GradeStats> grades = GradeComparison.compare(segments, MIN_PER_GRADE).stream()
                    .map(g -> new FuelStatsView.GradeStats(g.grade(), g.average(), g.segmentCount())).toList();
            BigDecimal average = ConsumptionCalculator.weightedAverage(segments);
            BigDecimal last = segments.isEmpty() ? null : segments.get(segments.size() - 1).per100km();
            out.add(new FuelStatsView.FuelTypeStats(type, type.unit(), average, last,
                    CostMetrics.avgUnitPrice(pricedOfType), segments.size(), points, alert, grades));
        }
        return List.copyOf(out);
    }
}
