package com.vehiclepassport.server.vehicle.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ownership_claim")
public class OwnershipClaimEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "claimant_id", nullable = false)
    public UUID claimantId;

    @Column(name = "status", nullable = false)
    public String status;

    @Column(name = "filed_at", nullable = false)
    public Instant filedAt;

    @Column(name = "decided_at")
    public Instant decidedAt;
}
