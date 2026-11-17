package com.vehiclepassport.server.event.infrastructure.persistence.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
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
@Table(name = "vehicle_event")
public class VehicleEventEntity {

    @Id
    @Column(name = "id")
    public UUID id;

    @Column(name = "vin", nullable = false, length = 17)
    public String vin;

    @Column(name = "type", nullable = false)
    public String type;

    @Column(name = "event_date", nullable = false)
    public LocalDate eventDate;

    @Column(name = "odometer_km")
    public Integer odometerKm;

    @Column(name = "cost_amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal costAmount;

    @Column(name = "currency", nullable = false, length = 3)
    public String currency;

    @Column(name = "custom_label", length = 60)
    public String customLabel;

    @Column(name = "notes")
    public String notes;

    @Column(name = "valid_from")
    public LocalDate validFrom;

    @Column(name = "valid_until")
    public LocalDate validUntil;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "components", nullable = false, columnDefinition = "text[]")
    public String[] components;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_fields", nullable = false, columnDefinition = "jsonb")
    public List<CustomFieldJson> customFields;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", columnDefinition = "jsonb")
    public DetailsJson details;

    @Column(name = "evidence", nullable = false)
    public String evidence;

    @Column(name = "source", nullable = false)
    public String source;

    @Column(name = "created_by", nullable = false)
    public UUID createdBy;

    @Column(name = "period_id", nullable = false)
    public UUID periodId;

    @Column(name = "document_key")
    public String documentKey;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "deleted_at")
    public Instant deletedAt;

    /**
     * Stored form of the typed details in the jsonb column: {@code kind} plus the fields of that kind, the others
     * absent. Rows written before V11 have no {@code kind}; they hold scan details.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DetailsJson(
            String kind,
            String serviceName, List<PartJson> parts, BigDecimal labor,
            String coverage, String insurer, String policyNumber,
            String duration,
            String station, String result,
            String item) {
    }

    public record PartJson(String name, BigDecimal qty, BigDecimal price) {
    }

    public record CustomFieldJson(String label, String value) {
    }
}
