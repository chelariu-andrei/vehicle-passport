package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** The end day is inclusive: N days end on validFrom + (N - 1); twelve months end the day before the anniversary. */
class RovinietaDurationTest {

    @ParameterizedTest(name = "{0} from {1} ends {2}")
    @CsvSource({
        "ONE_DAY,       2026-03-10, 2026-03-10",
        "SEVEN_DAYS,    2026-03-10, 2026-03-16",
        "THIRTY_DAYS,   2026-03-10, 2026-04-08",
        "NINETY_DAYS,   2026-03-10, 2026-06-07",
        "TWELVE_MONTHS, 2024-02-29, 2025-02-27",
        "TWELVE_MONTHS, 2026-01-31, 2027-01-30",
        "TWELVE_MONTHS, 2026-01-15, 2027-01-14"
    })
    void endFor(RovinietaDuration duration, LocalDate from, LocalDate expected) {
        assertEquals(expected, duration.endFor(from));
    }
}
