package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.model.SubmittedSupportReport;
import com.vehiclepassport.server.account.domain.model.SupportDiagnostics;
import com.vehiclepassport.server.account.domain.model.SupportKind;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Native SQL: the diagnostics column is jsonb. */
@ApplicationScoped
public class SupportReportRepository implements SupportReportPort {

    @Inject
    EntityManager em;
    @Inject
    ObjectMapper json;

    @Override
    public void save(UUID id, UUID userId, SupportReport report, Instant createdAt) {
        em.createNativeQuery("insert into vehicle_passport.support_report "
                        + "(id, user_id, kind, message, diagnostics, created_at) "
                        + "values (:id, :user, :kind, :message, cast(:diagnostics as jsonb), :createdAt)")
                .setParameter("id", id)
                .setParameter("user", userId)
                .setParameter("kind", report.kind().value())
                .setParameter("message", report.message())
                .setParameter("diagnostics", diagnostics(report.diagnostics()))
                .setParameter("createdAt", createdAt.truncatedTo(ChronoUnit.MICROS))
                .executeUpdate();
    }

    @Override
    public List<SubmittedSupportReport> findByUser(UUID userId) {
        List<?> rows = em.createNativeQuery("select kind, message, cast(diagnostics as text), created_at "
                        + "from vehicle_passport.support_report where user_id = :user order by created_at, id")
                .setParameter("user", userId)
                .getResultList();
        return rows.stream().map(r -> {
            Object[] row = (Object[]) r;
            return new SubmittedSupportReport(SupportKind.fromValue((String) row[0]), (String) row[1],
                    diagnostics((String) row[2]), toInstant(row[3]));
        }).toList();
    }

    private SupportDiagnostics diagnostics(String stored) {
        if (stored == null) {
            return null;
        }
        try {
            JsonNode n = json.readTree(stored);
            return new SupportDiagnostics(text(n, "appVersion"), text(n, "platform"), text(n, "osVersion"),
                    text(n, "deviceModel"));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Instant i) {
            return i;
        }
        if (value instanceof OffsetDateTime o) {
            return o.toInstant();
        }
        if (value instanceof Timestamp t) {
            return t.toInstant();
        }
        throw new IllegalStateException("Unexpected timestamp type " + value.getClass().getName());
    }

    private String diagnostics(SupportDiagnostics d) {
        if (d == null) {
            return null;
        }
        Map<String, String> m = new LinkedHashMap<>();
        m.put("appVersion", d.appVersion());
        m.put("platform", d.platform());
        m.put("osVersion", d.osVersion());
        m.put("deviceModel", d.deviceModel());
        try {
            return json.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
