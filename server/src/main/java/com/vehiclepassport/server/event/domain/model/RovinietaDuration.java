package com.vehiclepassport.server.event.domain.model;

import java.time.LocalDate;

/**
 * Length of a rovinietă. The end day is inclusive: an N-day rovinietă ends on {@code validFrom + (N - 1)} days, and a
 * twelve-month one ends the day before the same calendar day a year later ({@code validFrom + 12 months - 1 day}).
 */
public enum RovinietaDuration {
    ONE_DAY(1), SEVEN_DAYS(7), THIRTY_DAYS(30), NINETY_DAYS(90), TWELVE_MONTHS(0);

    private final int days;

    RovinietaDuration(int days) {
        this.days = days;
    }

    /** The last valid day for a rovinietă starting on {@code from}. */
    public LocalDate endFor(LocalDate from) {
        if (this == TWELVE_MONTHS) {
            return from.plusMonths(12).minusDays(1);
        }
        return from.plusDays(days - 1L);
    }
}
