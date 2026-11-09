package com.vehiclepassport.server.passport.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "passport")
public class PassportEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "created_by", nullable = false)
    public UUID createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    /** Plain text column on purpose: the exact bytes that were hashed must come back unchanged. */
    @Column(name = "snapshot_json", nullable = false, columnDefinition = "text")
    public String snapshotJson;

    @Column(name = "hash", nullable = false, length = 64)
    public String hash;

    @Column(name = "token", nullable = false, unique = true)
    public String token;

    @Column(name = "expires_at")
    public Instant expiresAt;

    @Column(name = "revoked_at")
    public Instant revokedAt;

    @Column(name = "pdf_key", nullable = false)
    public String pdfKey;
}
