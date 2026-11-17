package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.util.List;

/** Included segments in chronological order; {@code average} is weighted and null without segments. */
public record ConsumptionResult(List<ConsumptionSegment> segments, BigDecimal average) {

    public ConsumptionResult {
        segments = List.copyOf(segments);
    }
}
