package com.vehiclepassport.server.account.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "consent_record")
public class ConsentEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "user_id")
    public UUID userId;

    @Column(name = "subject_hash")
    public String subjectHash;

    @Column(name = "type", nullable = false)
    public String type;

    @Column(name = "version")
    public String version;

    @Column(name = "granted", nullable = false)
    public boolean granted;

    @Column(name = "source", nullable = false)
    public String source;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
