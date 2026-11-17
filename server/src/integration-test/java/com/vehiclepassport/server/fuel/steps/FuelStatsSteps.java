package com.vehiclepassport.server.fuel.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.port.in.FuelStatsView;
import com.vehiclepassport.server.fuel.application.port.in.GetFuelStatsUseCase;
import com.vehiclepassport.server.testsupport.World;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Reads {@link FuelStatsView} of V for the default period (6m), as the app does. */
@ApplicationScoped
public class FuelStatsSteps {

    private static final String STATS_KEY = "fuel.stats";

    @Inject
    World world;
    @Inject
    GetFuelStatsUseCase stats;

    @When("I request the fuel stats of V")
    public void iRequestTheFuelStatsOfV() {
        world.attempt(() -> world.put(STATS_KEY, stats.stats(world.me(), FuelSteps.VIN, "6m")));
    }

    @Then("the {word} average consumption is {bigdecimal}")
    public void theAverageConsumptionIs(String type, BigDecimal average) {
        assertEquals(average, block(type).avgConsumption());
    }

    @Then("the {word} average consumption is not available")
    public void theAverageConsumptionIsNotAvailable(String type) {
        assertNull(block(type).avgConsumption());
        assertEquals(0, block(type).segmentCount());
    }

    @Then("the fill-up of {word} has consumption {bigdecimal}")
    public void theFillUpHasConsumption(String date, BigDecimal consumption) {
        assertEquals(consumption, point(date).consumption());
    }

    @Then("the fill-up of {word} has no consumption")
    public void theFillUpHasNoConsumption(String date) {
        assertNull(point(date).consumption());
    }

    @Then("the {word} alert shows {bigdecimal} against a baseline of {bigdecimal}")
    public void theAlertShows(String type, BigDecimal latest, BigDecimal baseline) {
        FuelStatsView.Alert alert = block(type).alert();
        assertNotNull(alert, "expected an alert");
        assertEquals(latest, alert.latest());
        assertEquals(baseline, alert.baseline());
    }

    @Then("there is no {word} alert")
    public void thereIsNoAlert(String type) {
        assertNull(block(type).alert());
    }

    @Then("the {word} grade comparison shows {word} at {bigdecimal} over {int} tanks and {word} at {bigdecimal} "
            + "over {int} tanks")
    public void theGradeComparisonShows(String type, String grade1, BigDecimal avg1, int count1, String grade2,
            BigDecimal avg2, int count2) {
        List<FuelStatsView.GradeStats> grades = block(type).gradeComparison();
        assertEquals(2, grades.size(), grades::toString);
        assertGrade(grades, grade1, avg1, count1);
        assertGrade(grades, grade2, avg2, count2);
    }

    @Then("there is no {word} grade comparison")
    public void thereIsNoGradeComparison(String type) {
        assertTrue(block(type).gradeComparison().isEmpty());
    }

    @Then("the stats count {int} fill-ups")
    public void theStatsCountFillUps(int count) {
        assertEquals(count, view().entryCount());
    }

    @Then("the total cost is {bigdecimal}")
    public void theTotalCostIs(BigDecimal total) {
        assertEquals(total, view().totalCost());
    }

    @Then("the cost per km is {bigdecimal}")
    public void theCostPerKmIs(BigDecimal costPerKm) {
        assertEquals(costPerKm, view().costPerKm());
    }

    @Then("month {word} cost {bigdecimal} over {int} fill-up(s) and {int} km")
    public void monthCostWithDistance(String month, BigDecimal cost, int entries, int km) {
        FuelStatsView.MonthCost m = month(month);
        assertEquals(cost, m.cost());
        assertEquals(entries, m.entries());
        assertEquals(km, m.distanceKm());
    }

    @Then("month {word} cost {bigdecimal} over {int} fill-up(s) with no distance")
    public void monthCostWithoutDistance(String month, BigDecimal cost, int entries) {
        FuelStatsView.MonthCost m = month(month);
        assertEquals(cost, m.cost());
        assertEquals(entries, m.entries());
        assertNull(m.distanceKm());
    }

    @Then("the month estimate for {word} is {bigdecimal} with {bigdecimal} spent so far")
    public void theMonthEstimateIs(String month, BigDecimal projected, BigDecimal spent) {
        FuelStatsView.MonthEstimate e = view().monthEstimate();
        assertEquals(YearMonth.parse(month), e.month());
        assertEquals(projected, e.projected());
        assertEquals(spent, e.spentSoFar());
    }

    @Then("the month estimate for {word} is not available with {bigdecimal} spent so far")
    public void theMonthEstimateIsNotAvailable(String month, BigDecimal spent) {
        FuelStatsView.MonthEstimate e = view().monthEstimate();
        assertEquals(YearMonth.parse(month), e.month());
        assertNull(e.projected());
        assertEquals(spent, e.spentSoFar());
    }

    @Then("the stats are in {word} with {int} fill-ups and {int} ignored")
    public void theStatsAreIn(String currency, int entries, int ignored) {
        FuelStatsView v = view();
        assertEquals(currency, v.currency());
        assertEquals(entries, v.entryCount());
        assertEquals(ignored, v.ignoredEntries());
    }

    // ---- helpers ----

    private FuelStatsView view() {
        assertNull(world.lastError(), () -> "unexpected " + world.lastError());
        FuelStatsView v = world.get(STATS_KEY);
        assertNotNull(v, "no stats requested");
        return v;
    }

    private FuelStatsView.FuelTypeStats block(String type) {
        return view().byFuelType().stream().filter(b -> b.fuelType().name().equals(type)).findFirst()
                .orElseThrow(() -> new AssertionError("no " + type + " block in " + view().byFuelType()));
    }

    private FuelStatsView.Point point(String date) {
        LocalDate d = LocalDate.parse(date);
        return view().byFuelType().stream().flatMap(b -> b.points().stream()).filter(p -> p.date().equals(d))
                .findFirst().orElseThrow(() -> new AssertionError("no point on " + date));
    }

    private FuelStatsView.MonthCost month(String month) {
        YearMonth m = YearMonth.parse(month);
        return view().monthly().stream().filter(c -> c.month().equals(m)).findFirst()
                .orElseThrow(() -> new AssertionError("no month " + month + " in " + view().monthly()));
    }

    private static void assertGrade(List<FuelStatsView.GradeStats> grades, String grade, BigDecimal avg, int count) {
        FuelStatsView.GradeStats g = grades.stream().filter(s -> s.grade().name().equals(grade)).findFirst()
                .orElseThrow(() -> new AssertionError("no " + grade + " in " + grades));
        assertEquals(avg, g.avgConsumption());
        assertEquals(count, g.segmentCount());
    }
}
