package com.vehiclepassport.server.fuel;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.fuel.application.port.in.AddFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryView;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.path.json.JsonPath;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;

/** HTTP shapes and error codes of the fuel routes; the behaviour itself is covered by the Cucumber features. */
@QuarkusTest
@TestProfile(PersistenceProfile.class)
class FuelResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000f1";
    static final String OTHER = "00000000-0000-0000-0000-0000000000f2";

    private static final String JSON_UTF8 = "application/json; charset=UTF-8";
    private static final String PROBLEM = "application/problem+json";
    private static final String VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AddFuelEntryUseCase adding;

    private String registerAs(String user, String fuel) {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder vin = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            vin.append(VIN_ALPHABET.charAt(r.nextInt(VIN_ALPHABET.length())));
        }
        registering.register(new RegisterVehicleCommand(UUID.fromString(user), vin.toString(), "Dacia", "Duster",
                null, 2020, fuel));
        return vin.toString();
    }

    private FuelEntryView addAs(String user, String vin, String date, int km) {
        return adding.add(new FuelEntryCommand(UUID.fromString(user), vin, null, LocalDate.parse(date), km,
                FuelEntryType.DIESEL, new BigDecimal("40.0"), new BigDecimal("300.00"), "RON", true, false, null,
                null, null, null));
    }

    private static Map<String, Object> body(String date, int km, String fuelType) {
        Map<String, Object> m = new HashMap<>();
        m.put("date", date);
        m.put("odometerKm", km);
        m.put("fuelType", fuelType);
        m.put("quantity", 38.2);
        m.put("total", 312.00);
        m.put("currency", "RON");
        return m;
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_returns_201_with_unit_and_unit_price() {
        String vin = registerAs(ME, "DIESEL");
        Map<String, Object> body = body("2025-10-01", 10000, "DIESEL");
        body.put("grade", "PREMIUM");
        body.put("station", "Petrom A1");
        given().contentType(JSON_UTF8).body(body)
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(201)
                .contentType(startsWith("application/json"))
                .body("id", notNullValue())
                .body("date", equalTo("2025-10-01"))
                .body("odometerKm", equalTo(10000))
                .body("fuelType", equalTo("DIESEL"))
                .body("quantity", equalTo(38.2f))
                .body("unit", equalTo("L"))
                .body("total", equalTo(312.0f))
                .body("unitPrice", equalTo(8.1675f))
                .body("currency", equalTo("RON"))
                .body("fullTank", equalTo(true))
                .body("missedPrevious", equalTo(false))
                .body("grade", equalTo("PREMIUM"))
                .body("station", equalTo("Petrom A1"))
                .body("$", hasKey("chargeType"))
                .body("chargeType", nullValue())
                .body("$", hasKey("note"))
                .body("$", hasKey("consumption"))
                .body("consumption", nullValue());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_electric_returns_unit_kwh_on_a_hybrid() {
        String vin = registerAs(ME, "HYBRID");
        Map<String, Object> body = body("2025-10-01", 10000, "ELECTRIC");
        body.put("chargeType", "DC_FAST");
        given().contentType(JSON_UTF8).body(body)
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(201)
                .body("unit", equalTo("KWH"))
                .body("chargeType", equalTo("DC_FAST"))
                .body("grade", nullValue());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_unknown_field_is_400_validation_failed() {
        String vin = registerAs(ME, "DIESEL");
        Map<String, Object> body = body("2025-10-01", 10000, "DIESEL");
        body.put("pricePerLitre", 7.5);
        given().contentType(JSON_UTF8).body(body)
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(400)
                .contentType(startsWith(PROBLEM))
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_invalid_shape_is_400_validation_failed() {
        String vin = registerAs(ME, "DIESEL");
        for (Map.Entry<String, Object> bad : List.<Map.Entry<String, Object>>of(
                Map.entry("quantity", 0), Map.entry("quantity", 10000), Map.entry("total", -1),
                Map.entry("currency", "ron"), Map.entry("fuelType", "KEROSENE"), Map.entry("odometerKm", -1),
                Map.entry("grade", "SUPER"), Map.entry("chargeType", "SLOW"), Map.entry("station", "x".repeat(61)),
                Map.entry("note", "x".repeat(201)))) {
            Map<String, Object> body = body("2025-10-01", 10000, "DIESEL");
            body.put(bad.getKey(), bad.getValue());
            given().contentType(JSON_UTF8).body(body)
                    .when().post("/vehicles/" + vin + "/fuel-entries")
                    .then().statusCode(400)
                    .contentType(startsWith(PROBLEM))
                    .body("code", equalTo("validation-failed"));
        }
        Map<String, Object> missing = body("2025-10-01", 10000, "DIESEL");
        missing.remove("total");
        given().contentType(JSON_UTF8).body(missing)
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_electric_on_diesel_is_422_invalid_fuel_entry() {
        String vin = registerAs(ME, "DIESEL");
        given().contentType(JSON_UTF8).body(body("2025-10-01", 10000, "ELECTRIC"))
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(422)
                .contentType(startsWith(PROBLEM))
                .body("code", equalTo("invalid-fuel-entry"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_low_km_is_422_odometer_inconsistent() {
        String vin = registerAs(ME, "DIESEL");
        addAs(ME, vin, "2025-10-01", 10000);
        given().contentType(JSON_UTF8).body(body("2025-10-20", 9900, "DIESEL"))
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(422)
                .contentType(startsWith(PROBLEM))
                .body("code", equalTo("odometer-inconsistent"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void put_replaces_and_returns_200() {
        String vin = registerAs(ME, "DIESEL");
        FuelEntryView created = addAs(ME, vin, "2025-10-01", 10000);
        Map<String, Object> body = body("2025-10-02", 10100, "DIESEL");
        body.put("fullTank", false);
        body.put("note", "half tank");
        given().contentType(JSON_UTF8).body(body)
                .when().put("/vehicles/" + vin + "/fuel-entries/" + created.id())
                .then().statusCode(200)
                .body("id", equalTo(created.id().toString()))
                .body("date", equalTo("2025-10-02"))
                .body("odometerKm", equalTo(10100))
                .body("fullTank", equalTo(false))
                .body("missedPrevious", equalTo(false))
                .body("note", equalTo("half tank"))
                .body("unitPrice", equalTo(8.1675f));
        given().contentType(JSON_UTF8).body(body)
                .when().put("/vehicles/" + vin + "/fuel-entries/" + UUID.randomUUID())
                .then().statusCode(404).contentType(startsWith(PROBLEM)).body("code", equalTo("fuel-entry-not-found"));
        given().contentType(JSON_UTF8).body(body)
                .when().put("/vehicles/" + vin + "/fuel-entries/not-a-uuid")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void delete_returns_204_then_404() {
        String vin = registerAs(ME, "DIESEL");
        FuelEntryView created = addAs(ME, vin, "2025-10-01", 10000);
        given().when().delete("/vehicles/" + vin + "/fuel-entries/" + created.id()).then().statusCode(204);
        given().when().get("/vehicles/" + vin + "/fuel-entries").then().statusCode(200).body("items", hasSize(0));
        given().when().delete("/vehicles/" + vin + "/fuel-entries/" + created.id())
                .then().statusCode(404)
                .contentType(startsWith(PROBLEM))
                .body("code", equalTo("fuel-entry-not-found"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_list_paginates() {
        String vin = registerAs(ME, "DIESEL");
        FuelEntryView first = addAs(ME, vin, "2025-10-01", 10000);
        FuelEntryView second = addAs(ME, vin, "2025-10-20", 10600);
        FuelEntryView third = addAs(ME, vin, "2025-11-05", 11200);

        JsonPath page1 = given().queryParam("limit", "2").when().get("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(200).body("items", hasSize(2)).extract().jsonPath();
        assertEquals(List.of(third.id().toString(), second.id().toString()), page1.getList("items.id"));
        assertEquals(6.67f, page1.getFloat("items[1].consumption"));
        String cursor = page1.getString("nextCursor");
        assertNotNull(cursor);

        JsonPath page2 = given().queryParam("limit", "2").queryParam("cursor", cursor)
                .when().get("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(200).body("items", hasSize(1)).body("$", hasKey("nextCursor"))
                .extract().jsonPath();
        assertEquals(List.of(first.id().toString()), page2.getList("items.id"));
        assertNull(page2.getString("nextCursor"));

        given().when().get("/vehicles/" + vin + "/fuel-entries").then().statusCode(200).body("items", hasSize(3));
        for (String bad : List.of("0", "101", "abc", "-1")) {
            given().queryParam("limit", bad).when().get("/vehicles/" + vin + "/fuel-entries")
                    .then().statusCode(400).contentType(startsWith(PROBLEM)).body("code", equalTo("validation-failed"));
        }
        given().queryParam("cursor", "not a cursor").when().get("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(400).contentType(startsWith(PROBLEM)).body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_stats_defaults_to_6m() {
        String vin = registerAs(ME, "DIESEL");
        LocalDate today = LocalDate.now();
        addAs(ME, vin, today.minusDays(20).toString(), 10000);
        addAs(ME, vin, today.minusDays(5).toString(), 10600);

        given().when().get("/vehicles/" + vin + "/fuel/stats")
                .then().statusCode(200)
                .contentType(startsWith("application/json"))
                .body("currency", equalTo("RON"))
                .body("period.from", equalTo(today.minusMonths(6).toString()))
                .body("period.to", equalTo(today.toString()))
                .body("lastOdometerKm", equalTo(10600))
                .body("entryCount", equalTo(2))
                .body("ignoredEntries", equalTo(0))
                .body("totalCost", equalTo(600.0f))
                .body("costPerKm", equalTo(0.5f))
                .body("monthly[0].month", org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}"))
                .body("monthEstimate.month", equalTo(today.toString().substring(0, 7)))
                .body("monthEstimate", hasKey("projected"))
                .body("monthEstimate.projected", nullValue())
                .body("byFuelType", hasSize(1))
                .body("byFuelType[0].fuelType", equalTo("DIESEL"))
                .body("byFuelType[0].unit", equalTo("L"))
                .body("byFuelType[0].avgConsumption", equalTo(6.67f))
                .body("byFuelType[0].lastConsumption", equalTo(6.67f))
                .body("byFuelType[0].segmentCount", equalTo(1))
                .body("byFuelType[0].points", hasSize(2))
                .body("byFuelType[0].points[0].consumption", nullValue())
                .body("byFuelType[0].points[1].consumption", equalTo(6.67f))
                .body("byFuelType[0]", hasKey("alert"))
                .body("byFuelType[0].alert", nullValue())
                .body("byFuelType[0].gradeComparison", hasSize(0));

        given().queryParam("period", "all").when().get("/vehicles/" + vin + "/fuel/stats")
                .then().statusCode(200).body("period.from", nullValue()).body("entryCount", equalTo(2));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_stats_of_an_empty_car_is_200_with_nulls() {
        String vin = registerAs(ME, "DIESEL");
        given().when().get("/vehicles/" + vin + "/fuel/stats")
                .then().statusCode(200)
                .body("currency", nullValue())
                .body("lastOdometerKm", nullValue())
                .body("entryCount", equalTo(0))
                .body("costPerKm", nullValue())
                .body("monthly", hasSize(0))
                .body("byFuelType", hasSize(0));
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_stats_bad_period_is_400() {
        String vin = registerAs(ME, "DIESEL");
        for (String bad : List.of("1m", "ALL", "6")) {
            given().queryParam("period", bad).when().get("/vehicles/" + vin + "/fuel/stats")
                    .then().statusCode(400).contentType(startsWith(PROBLEM)).body("code", equalTo("validation-failed"));
        }
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void other_owner_gets_404_vehicle_not_found() {
        String vin = registerAs(OTHER, "DIESEL");
        FuelEntryView theirs = addAs(OTHER, vin, "2025-10-01", 10000);
        given().contentType(JSON_UTF8).body(body("2025-10-20", 10600, "DIESEL"))
                .when().post("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(404).contentType(startsWith(PROBLEM)).body("code", equalTo("vehicle-not-found"));
        given().when().get("/vehicles/" + vin + "/fuel-entries")
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
        given().contentType(JSON_UTF8).body(body("2025-10-20", 10600, "DIESEL"))
                .when().put("/vehicles/" + vin + "/fuel-entries/" + theirs.id())
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
        given().when().delete("/vehicles/" + vin + "/fuel-entries/" + theirs.id())
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
        given().when().get("/vehicles/" + vin + "/fuel/stats")
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
    }
}
