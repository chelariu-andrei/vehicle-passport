package com.vehiclepassport.server.vehicle.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "vehicle")
public class VehicleEntity {

    @Id
    @Column(name = "vin", length = 17)
    public String vin;

    @Column(name = "make", nullable = false)
    public String make;

    @Column(name = "model", nullable = false)
    public String model;

    @Column(name = "engine")
    public String engine;

    @Column(name = "year", nullable = false)
    public int year;

    @Column(name = "fuel", nullable = false)
    public String fuel;
}
