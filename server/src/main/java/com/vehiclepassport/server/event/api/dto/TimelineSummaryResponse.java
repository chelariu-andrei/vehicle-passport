package com.vehiclepassport.server.event.api.dto;

import java.math.BigDecimal;
import java.util.List;

/** The contract's {@code TimelineSummary}, with its {@code TypeCount}, {@code CurrencyAmount} and {@code Distance}. */
public record TimelineSummaryResponse(long eventCount, List<TypeCountDto> countsByType,
        List<CurrencyAmountDto> costByCurrency, DistanceDto distance, List<Integer> years) {

    public record TypeCountDto(String type, long count) {
    }

    /** The amount keeps its two decimals in JSON, like {@code EventResponse.costAmount}. */
    public record CurrencyAmountDto(String currency, BigDecimal amount) {
    }

    /** Every field is always present, null when unknown. */
    public record DistanceDto(Integer km, Integer fromKm, Integer toKm) {
    }
}
