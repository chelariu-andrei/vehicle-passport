package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.account.application.port.out.SupportReportPort;
import com.vehiclepassport.server.account.domain.model.SupportDiagnostics;
import com.vehiclepassport.server.account.domain.model.SupportReport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
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
