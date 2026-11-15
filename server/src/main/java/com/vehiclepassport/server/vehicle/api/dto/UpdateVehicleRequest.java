package com.vehiclepassport.server.vehicle.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Partial update; an absent field keeps its current value. A class, not a record, because {@code "plate": null}
 * (clear it) and no {@code plate} at all (keep it) mean different things, and only setters can tell them apart.
 */
public class UpdateVehicleRequest {

    @Size(min = 1, max = 100)
    private String make;
    @Size(min = 1, max = 100)
    private String model;
    @Size(max = 100)
    private String engine;
    @Min(1886)
    private Integer year;
    private String fuel;
    @Size(min = 1, max = 10)
    @Pattern(regexp = "^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$", message = "plate is not valid")
    private String plate;
    @Valid
    private AppearanceDto appearance;

    @JsonIgnore
    private boolean plateGiven;
    @JsonIgnore
    private boolean appearanceGiven;

    public UpdateVehicleRequest() {
    }

    public String make() {
        return make;
    }

    public String model() {
        return model;
    }

    public String engine() {
        return engine;
    }

    public Integer year() {
        return year;
    }

    public String fuel() {
        return fuel;
    }

    public String plate() {
        return plate;
    }

    public AppearanceDto appearance() {
        return appearance;
    }

    /** True when the body named {@code plate}, even as null. */
    public boolean hasPlate() {
        return plateGiven;
    }

    @JsonProperty("make")
    public void setMake(String make) {
        this.make = make;
    }

    @JsonProperty("model")
    public void setModel(String model) {
        this.model = model;
    }

    @JsonProperty("engine")
    public void setEngine(String engine) {
        this.engine = engine;
    }

    @JsonProperty("year")
    public void setYear(Integer year) {
        this.year = year;
    }

    @JsonProperty("fuel")
    public void setFuel(String fuel) {
        this.fuel = fuel;
    }

    @JsonProperty("plate")
    public void setPlate(String plate) {
        this.plate = plate;
        this.plateGiven = true;
    }

    @JsonProperty("appearance")
    public void setAppearance(AppearanceDto appearance) {
        this.appearance = appearance;
        this.appearanceGiven = true;
    }

    @JsonIgnore
    @AssertTrue(message = "at least one field is required")
    public boolean isNotEmpty() {
        return make != null || model != null || engine != null || year != null || fuel != null || plateGiven
                || appearanceGiven;
    }

    @JsonIgnore
    @AssertTrue(message = "appearance may not be null")
    public boolean isAppearanceNotNull() {
        return !appearanceGiven || appearance != null;
    }
}
