package com.vehiclepassport.server.account.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_profile")
public class ProfileEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "email")
    public String email;

    @Column(name = "display_name")
    public String displayName;

    @Column(name = "phone")
    public String phone;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "deletion_scheduled_for")
    public Instant deletionScheduledFor;
}
