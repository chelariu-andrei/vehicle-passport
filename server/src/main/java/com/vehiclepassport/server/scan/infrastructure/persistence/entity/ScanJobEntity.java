package com.vehiclepassport.server.scan.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "scan_job")
public class ScanJobEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "batch_id", nullable = false)
    public UUID batchId;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "owner_id", nullable = false)
    public UUID ownerId;

    @Column(name = "period_id", nullable = false)
    public UUID periodId;

    @Column(name = "document_key", nullable = false)
    public String documentKey;

    @Column(name = "content_type", nullable = false)
    public String contentType;

    @Column(name = "status", nullable = false)
    public String status;

    @Column(name = "attempts", nullable = false)
    public int attempts;

    @Column(name = "processing_started_at")
    public Instant processingStartedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result", columnDefinition = "jsonb")
    public ResultJson result;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "warnings", nullable = false, columnDefinition = "jsonb")
    public List<String> warnings;

    @Column(name = "failure_reason")
    public String failureReason;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    /** Stored form of an extraction result in the jsonb column. A null field was not extracted. */
    public record ResultJson(TextField serviceName, DateField date, IntField odometerKm, PartsField parts,
            NumberField labor, NumberField total) {
    }

    public record TextField(String value, double confidence) {
    }

    public record DateField(LocalDate value, double confidence) {
    }

    public record IntField(Integer value, double confidence) {
    }

    public record NumberField(BigDecimal value, double confidence) {
    }

    public record PartsField(List<PartJson> value, double confidence) {
    }

    public record PartJson(String name, BigDecimal qty, BigDecimal price) {
    }
}
