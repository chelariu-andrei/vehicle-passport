package com.vehiclepassport.server.fuel.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "fuel_entry")
public class FuelEntryEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "period_id", nullable = false)
    public UUID periodId;

    @Column(name = "created_by", nullable = false)
    public UUID createdBy;

    @Column(name = "entry_date", nullable = false)
    public LocalDate entryDate;

    @Column(name = "odometer_km", nullable = false)
    public int odometerKm;

    @Column(name = "fuel_type", nullable = false, length = 20)
    public String fuelType;

    @Column(name = "quantity", nullable = false, precision = 9, scale = 3)
    public BigDecimal quantity;

    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    public BigDecimal total;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 4)
    public BigDecimal unitPrice;

    @Column(name = "currency", nullable = false, length = 3)
    public String currency;

    @Column(name = "grade", length = 10)
    public String grade;

    @Column(name = "charge_type", length = 10)
    public String chargeType;

    @Column(name = "station", length = 60)
    public String station;

    @Column(name = "note", length = 200)
    public String note;

    @Column(name = "full_tank", nullable = false)
    public boolean fullTank;

    @Column(name = "missed_previous", nullable = false)
    public boolean missedPrevious;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @Column(name = "deleted_at")
    public Instant deletedAt;
}
