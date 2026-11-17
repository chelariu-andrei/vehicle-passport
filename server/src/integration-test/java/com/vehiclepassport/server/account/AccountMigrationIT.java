package com.vehiclepassport.server.account;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class AccountMigrationIT {

    @Inject
    DataSource dataSource;

    private int update(String sql, Object... args) throws SQLException {
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i + 1, args[i]);
            }
            return ps.executeUpdate();
        }
    }

    private List<String> query(String sql) throws SQLException {
        List<String> rows = new ArrayList<>();
        try (Connection c = dataSource.getConnection();
                PreparedStatement ps = c.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                rows.add(rs.getString(1));
            }
        }
        return rows;
    }

    @Test
    void tables_exist() throws SQLException {
        List<String> tables = query("select table_name from information_schema.tables "
                + "where table_schema = 'vehicle_passport'");
        for (String t : List.of("user_profile", "user_settings", "legal_document", "consent_record",
                "support_report")) {
            assertTrue(tables.contains(t), "missing table " + t);
        }
    }

    @Test
    void invalid_phone_violates_check() {
        SQLException e = assertThrows(SQLException.class, () -> update(
                "insert into vehicle_passport.user_profile (id, phone, created_at) values (?, '0712', now())",
                UUID.randomUUID()));
        assertTrue(e.getMessage().contains("phone"), e.getMessage());
    }

    @Test
    void valid_phone_is_accepted() throws SQLException {
        assertEquals(1, update("insert into vehicle_passport.user_profile (id, phone, created_at) "
                + "values (?, '+40712345678', now())", UUID.randomUUID()));
    }

    @Test
    void only_one_current_document_per_type_and_locale() {
        assertThrows(SQLException.class, () -> update("insert into vehicle_passport.legal_document "
                + "(type, locale, version, title, body_markdown, effective_date, is_current) "
                + "values ('terms', 'ro', '9.9', 't', 'b', current_date, true)"));
    }

    @Test
    void legal_seed_has_one_current_per_type_and_locale() throws SQLException {
        List<String> rows = query("select type || '/' || locale || '/' || version || '/' || count(*) "
                + "from vehicle_passport.legal_document where is_current group by type, locale, version "
                + "order by 1");
        assertEquals(List.of("data-sharing/en/1.0/1", "data-sharing/ro/1.0/1", "privacy/en/1.0/1",
                "privacy/ro/1.0/1", "terms/en/1.0/1", "terms/ro/1.0/1"), rows);
        assertEquals(List.of("6"), query("select count(*) from vehicle_passport.legal_document "
                + "where body_markdown like '%PLACEHOLDER — legal review required%'"));
    }

    @Test
    void tire_season_defaults_to_true_for_rows_written_without_it() throws SQLException {
        UUID id = UUID.randomUUID();
        update("insert into vehicle_passport.user_settings "
                + "(user_id, language, appearance, distance_unit, currency, notif_document_deadlines, "
                + "notif_reminder_days, notif_scans, notif_passport_views, notif_transfers) "
                + "values (?, 'ro', 'system', 'km', 'RON', true, '{30}', true, true, true)", id);
        assertEquals(List.of("t"), query("select notif_tire_season from vehicle_passport.user_settings "
                + "where user_id = '" + id + "'"));
    }

    @Test
    void settings_and_support_checks() {
        UUID id = UUID.randomUUID();
        assertThrows(SQLException.class, () -> update("insert into vehicle_passport.user_settings "
                + "(user_id, language, appearance, distance_unit, currency, notif_document_deadlines, "
                + "notif_reminder_days, notif_scans, notif_passport_views, notif_transfers) "
                + "values (?, 'fr', 'system', 'km', 'RON', true, '{30}', true, true, true)", id));
        assertThrows(SQLException.class, () -> update("insert into vehicle_passport.user_settings "
                + "(user_id, language, appearance, distance_unit, currency, notif_document_deadlines, "
                + "notif_reminder_days, notif_scans, notif_passport_views, notif_transfers) "
                + "values (?, 'ro', 'system', 'km', 'RON', true, '{14}', true, true, true)", id));
        assertThrows(SQLException.class, () -> update("insert into vehicle_passport.support_report "
                + "(id, kind, message, created_at) values (?, 'complaint', 'long enough message', now())",
                UUID.randomUUID()));
        assertThrows(SQLException.class, () -> update("insert into vehicle_passport.consent_record "
                + "(id, user_id, type, granted, source, created_at) values (?, ?, 'cookies', true, 'settings', now())",
                UUID.randomUUID(), UUID.randomUUID()));
    }
}
