package com.vehiclepassport.server.fuel.api.mapper;

import com.vehiclepassport.server.fuel.api.dto.FuelEntryPageResponse;
import com.vehiclepassport.server.fuel.api.dto.FuelEntryRequest;
import com.vehiclepassport.server.fuel.api.dto.FuelEntryResponse;
import com.vehiclepassport.server.fuel.api.dto.FuelStatsResponse;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryPage;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryView;
import com.vehiclepassport.server.fuel.application.port.in.FuelStatsView;
import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.YearMonth;
import java.util.UUID;

/** Enum names arrive already checked by the request's patterns; the contract defaults are applied here. */
@ApplicationScoped
public class FuelDtoMapper {

    /** {@code entryId} is null on add. */
    public FuelEntryCommand toCommand(UUID userId, String vin, UUID entryId, FuelEntryRequest r) {
        return new FuelEntryCommand(userId, vin, entryId, r.date(), r.odometerKm(),
                FuelEntryType.valueOf(r.fuelType()), r.quantity(), r.total(), r.currency(),
                r.fullTank() == null || r.fullTank(), r.missedPrevious() != null && r.missedPrevious(),
                r.grade() == null ? null : FuelGrade.valueOf(r.grade()),
                r.chargeType() == null ? null : ChargeType.valueOf(r.chargeType()), r.station(), r.note());
    }

    public FuelEntryResponse toResponse(FuelEntryView v) {
        return new FuelEntryResponse(v.id(), v.date(), v.odometerKm(), v.fuelType().name(), v.quantity(),
                v.unit().name(), v.total(), v.unitPrice(), v.currency(), v.fullTank(), v.missedPrevious(),
                name(v.grade()), name(v.chargeType()), v.station(), v.note(), v.consumption());
    }

    public FuelEntryPageResponse toResponse(FuelEntryPage p) {
        return new FuelEntryPageResponse(p.items().stream().map(this::toResponse).toList(), p.nextCursor());
    }

    public FuelStatsResponse toResponse(FuelStatsView s) {
        return new FuelStatsResponse(s.currency(),
                new FuelStatsResponse.PeriodDto(s.period().from(), s.period().to()), s.lastOdometerKm(),
                s.entryCount(), s.ignoredEntries(), s.totalCost(), s.costPerKm(),
                s.monthly().stream().map(m -> new FuelStatsResponse.MonthCostDto(month(m.month()), m.cost(),
                        m.quantity(), m.entries(), m.distanceKm())).toList(),
                new FuelStatsResponse.MonthEstimateDto(month(s.monthEstimate().month()),
                        s.monthEstimate().spentSoFar(), s.monthEstimate().projected()),
                s.byFuelType().stream().map(FuelDtoMapper::toDto).toList());
    }

    private static FuelStatsResponse.FuelTypeStatsDto toDto(FuelStatsView.FuelTypeStats t) {
        FuelStatsView.Alert a = t.alert();
        return new FuelStatsResponse.FuelTypeStatsDto(t.fuelType().name(), t.unit().name(), t.avgConsumption(),
                t.lastConsumption(), t.avgUnitPrice(), t.segmentCount(),
                t.points().stream().map(p -> new FuelStatsResponse.PointDto(p.entryId(), p.date(), p.odometerKm(),
                        p.unitPrice(), p.consumption())).toList(),
                a == null ? null : new FuelStatsResponse.AlertDto(a.latest(), a.baseline(), a.deltaPct(),
                        a.entryId()),
                t.gradeComparison().stream().map(g -> new FuelStatsResponse.GradeComparisonDto(g.grade().name(),
                        g.avgConsumption(), g.segmentCount())).toList());
    }

    /** {@code YYYY-MM}. */
    private static String month(YearMonth m) {
        return m == null ? null : m.toString();
    }

    private static String name(Enum<?> e) {
        return e == null ? null : e.name();
    }
}
