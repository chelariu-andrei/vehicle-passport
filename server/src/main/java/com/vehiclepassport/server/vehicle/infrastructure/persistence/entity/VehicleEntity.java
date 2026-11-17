package com.vehiclepassport.server.vehicle.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    @Column(name = "plate", length = 10)
    public String plate;

    @Column(name = "body_type")
    public String bodyType;

    @Column(name = "paint_color")
    public String paintColor;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "paint_hex", columnDefinition = "char(7)")
    public String paintHex;

    @Column(name = "paint_finish")
    public String paintFinish;

    @Column(name = "wheel_style")
    public String wheelStyle;

    @Column(name = "rim_color")
    public String rimColor;

    @Column(name = "glass_tint")
    public String glassTint;

    @Column(name = "contrast_roof")
    public Boolean contrastRoof;
}
