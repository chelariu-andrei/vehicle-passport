package com.vehiclepassport.server.event.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "event_attachment")
public class EventAttachmentEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "event_id", nullable = false)
    public UUID eventId;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "sha256", columnDefinition = "char(64)")
    public String sha256;

    @Column(name = "content_type", nullable = false, length = 100)
    public String contentType;

    @Column(name = "size_bytes", nullable = false)
    public long sizeBytes;

    @Column(name = "storage_key", nullable = false)
    public String storageKey;

    @Column(name = "kind", nullable = false, length = 20)
    public String kind;

    @Column(name = "created_by", nullable = false)
    public UUID createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "deleted_at")
    public Instant deletedAt;
}
