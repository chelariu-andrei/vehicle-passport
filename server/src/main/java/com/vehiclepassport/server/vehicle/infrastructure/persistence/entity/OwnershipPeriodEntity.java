package com.vehiclepassport.server.vehicle.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ownership_period")
public class OwnershipPeriodEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "owner_id", nullable = false)
    public UUID ownerId;

    @Column(name = "owned_from", nullable = false)
    public Instant ownedFrom;

    @Column(name = "owned_to")
    public Instant ownedTo;
}
