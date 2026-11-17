package com.vehiclepassport.server.fuel.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ConsumptionCalculatorTest {

    private static final LocalDate D0 = LocalDate.of(2026, 9, 1);
    private static final Instant T0 = Instant.parse("2026-11-17T10:00:00Z");

    private static int seq = 0;

    private static FuelEntry entry(FuelEntryType type, LocalDate date, int km, String quantity, boolean full,
            boolean missed, FuelGrade grade, Instant createdAt) {
        return new FuelEntry(UUID.randomUUID(), "WVWZZZ1JZXW000001", UUID.randomUUID(), UUID.randomUUID(), date, km,
                type, new BigDecimal(quantity), new BigDecimal("100.00"), new BigDecimal("1.0000"), "RON", grade,
                null, null, null, full, missed, createdAt);
    }

    /** Diesel entry; each call gets a later date and creation time so input order is the chronological one. */
    private static FuelEntry diesel(int km, String quantity, boolean full) {
        seq++;
        return entry(FuelEntryType.DIESEL, D0.plusDays(seq), km, quantity, full, false, null, T0.plusSeconds(seq));
    }

    private static FuelEntry full(int km, String quantity) {
        return diesel(km, quantity, true);
    }

    private static FuelEntry partial(int km, String quantity) {
        return diesel(km, quantity, false);
    }

    private static FuelEntry graded(int km, String quantity, boolean full, FuelGrade grade) {
        seq++;
        return entry(FuelEntryType.PETROL, D0.plusDays(seq), km, quantity, full, false, grade, T0.plusSeconds(seq));
    }

    @Test
    void two_full_tanks() {
        FuelEntry a = full(10000, "40");
        FuelEntry b = full(10600, "42");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, b));

        assertEquals(1, r.segments().size());
        ConsumptionSegment s = r.segments().get(0);
        assertEquals(b.id(), s.closingEntryId());
        assertEquals(b.date(), s.date());
        assertEquals(10600, s.odometerKm());
        assertEquals(0, new BigDecimal("42").compareTo(s.quantity()));
        assertEquals(600, s.km());
        assertEquals(new BigDecimal("7.00"), s.per100km());
        assertEquals(new BigDecimal("7.00"), r.average());
    }

    @Test
    void partial_in_between_counts_but_does_not_close() {
        FuelEntry a = full(10000, "40");
        FuelEntry p = partial(10300, "20");
        FuelEntry b = full(10600, "22");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, p, b));

        assertEquals(1, r.segments().size());
        ConsumptionSegment s = r.segments().get(0);
        assertEquals(b.id(), s.closingEntryId());
        assertEquals(0, new BigDecimal("42").compareTo(s.quantity()));
        assertEquals(new BigDecimal("7.00"), s.per100km());
        assertTrue(r.segments().stream().noneMatch(x -> x.closingEntryId().equals(p.id())));
    }

    @Test
    void missed_previous_excludes_segment() {
        FuelEntry a = full(10000, "40");
        seq++;
        FuelEntry missed = entry(FuelEntryType.DIESEL, D0.plusDays(seq), 10600, "42", true, true, null,
                T0.plusSeconds(seq));
        FuelEntry c = full(11200, "36");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, missed, c));

        // the discarded segment still re-anchors at its closing full fill-up
        assertEquals(1, r.segments().size());
        assertEquals(c.id(), r.segments().get(0).closingEntryId());
        assertEquals(600, r.segments().get(0).km());
        assertEquals(new BigDecimal("6.00"), r.segments().get(0).per100km());
        assertEquals(new BigDecimal("6.00"), r.average());
    }

    @Test
    void missed_previous_on_a_partial_excludes_the_segment_it_belongs_to() {
        FuelEntry a = full(10000, "40");
        seq++;
        FuelEntry missedPartial = entry(FuelEntryType.DIESEL, D0.plusDays(seq), 10300, "20", false, true, null,
                T0.plusSeconds(seq));
        FuelEntry b = full(10600, "22");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, missedPartial, b));

        assertTrue(r.segments().isEmpty());
        assertNull(r.average());
    }

    @Test
    void first_full_only_opens() {
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(full(10000, "40")));

        assertTrue(r.segments().isEmpty());
        assertNull(r.average());
    }

    @Test
    void no_entries_no_segments() {
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of());

        assertTrue(r.segments().isEmpty());
        assertNull(r.average());
    }

    @Test
    void partial_first_entry_is_ignored_until_a_full_one() {
        FuelEntry p = partial(9800, "10");
        FuelEntry a = full(10000, "40");
        FuelEntry b = full(10600, "42");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(p, a, b));

        assertEquals(1, r.segments().size());
        assertEquals(b.id(), r.segments().get(0).closingEntryId());
        assertEquals(0, new BigDecimal("42").compareTo(r.segments().get(0).quantity()));
        assertEquals(new BigDecimal("7.00"), r.segments().get(0).per100km());
    }

    @Test
    void km_zero_or_negative_excluded() {
        FuelEntry a = full(10000, "40");
        FuelEntry sameKm = full(10000, "5");
        FuelEntry c = full(10600, "42");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, sameKm, c));

        assertEquals(1, r.segments().size());
        assertEquals(c.id(), r.segments().get(0).closingEntryId());
        assertEquals(new BigDecimal("7.00"), r.segments().get(0).per100km());
    }

    @Test
    void under_20_km_excluded() {
        FuelEntry a = full(10000, "40");
        FuelEntry near = full(10019, "2");
        FuelEntry c = full(10619, "42");
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, near, c));

        assertEquals(1, r.segments().size());
        assertEquals(c.id(), r.segments().get(0).closingEntryId());
        assertEquals(600, r.segments().get(0).km());
        assertEquals(new BigDecimal("7.00"), r.segments().get(0).per100km());
    }

    @Test
    void exactly_20_km_is_included() {
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(full(10000, "40"), full(10020, "2")));

        assertEquals(1, r.segments().size());
        assertEquals(new BigDecimal("10.00"), r.segments().get(0).per100km());
    }

    @Test
    void unsorted_input_same_result() {
        List<FuelEntry> sorted = List.of(full(10000, "40"), partial(10300, "20"), full(10600, "22"),
                full(11200, "36"), full(11700, "35"));
        List<FuelEntry> shuffled = new ArrayList<>(sorted);
        Collections.reverse(shuffled);
        Collections.swap(shuffled, 1, 3);

        assertEquals(ConsumptionCalculator.calculate(sorted), ConsumptionCalculator.calculate(shuffled));
    }

    @Test
    void same_date_and_km_ordered_by_created_at() {
        LocalDate d2 = D0.plusDays(30);
        FuelEntry a = entry(FuelEntryType.DIESEL, D0, 10000, "40", true, false, null, T0);
        FuelEntry earlier = entry(FuelEntryType.DIESEL, d2, 10600, "3", true, false, null, T0.plusSeconds(3600));
        FuelEntry later = entry(FuelEntryType.DIESEL, d2, 10600, "42", true, false, null, T0.plusSeconds(7200));

        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(later, earlier, a));

        // a -> earlier closes the 600 km segment; earlier -> later has 0 km and is excluded
        assertEquals(1, r.segments().size());
        assertEquals(earlier.id(), r.segments().get(0).closingEntryId());
        assertEquals(new BigDecimal("0.50"), r.segments().get(0).per100km());
    }

    @Test
    void weighted_average_not_mean_of_means() {
        ConsumptionResult r = ConsumptionCalculator.calculate(
                List.of(full(10000, "40"), full(10100, "6"), full(11000, "72")));

        assertEquals(2, r.segments().size());
        assertEquals(new BigDecimal("6.00"), r.segments().get(0).per100km());
        assertEquals(new BigDecimal("8.00"), r.segments().get(1).per100km());
        assertEquals(new BigDecimal("7.80"), r.average());
    }

    @Test
    void per100km_rounds_half_up_to_two_decimals() {
        // 38.2 / 600 * 100 = 6.3666...
        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(full(10000, "40"), full(10600, "38.2")));

        assertEquals(new BigDecimal("6.37"), r.segments().get(0).per100km());
        assertEquals(new BigDecimal("6.37"), r.average());
    }

    @Test
    void electric_uses_kwh_quantity() {
        seq++;
        FuelEntry a = entry(FuelEntryType.ELECTRIC, D0.plusDays(seq), 20000, "30", true, false, null,
                T0.plusSeconds(seq));
        seq++;
        FuelEntry b = entry(FuelEntryType.ELECTRIC, D0.plusDays(seq), 20120, "18", true, false, null,
                T0.plusSeconds(seq));

        ConsumptionResult r = ConsumptionCalculator.calculate(List.of(a, b));

        assertEquals(new BigDecimal("15.00"), r.segments().get(0).per100km());
        assertEquals(new BigDecimal("15.00"), r.average());
    }

    @Test
    void segment_grade_only_when_all_entries_share_it() {
        List<FuelEntry> entries = List.of(graded(10000, "40", true, FuelGrade.STANDARD),
                graded(10300, "20", false, FuelGrade.PREMIUM), graded(10600, "22", true, FuelGrade.PREMIUM),
                graded(10900, "20", false, FuelGrade.STANDARD), graded(11200, "22", true, FuelGrade.PREMIUM),
                graded(11500, "20", false, null), graded(11800, "22", true, FuelGrade.STANDARD),
                graded(12400, "42", true, FuelGrade.STANDARD));

        List<ConsumptionSegment> s = ConsumptionCalculator.calculate(entries).segments();

        assertEquals(4, s.size());
        assertEquals(FuelGrade.PREMIUM, s.get(0).grade()); // anchor's own grade does not count
        assertNull(s.get(1).grade()); // mixed
        assertNull(s.get(2).grade()); // one untagged entry
        assertEquals(FuelGrade.STANDARD, s.get(3).grade());
    }
}
