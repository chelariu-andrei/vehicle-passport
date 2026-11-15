package com.vehiclepassport.server.account.infrastructure.persistence.repository;

import com.vehiclepassport.server.account.application.port.out.SettingsPort;
import com.vehiclepassport.server.account.domain.model.Appearance;
import com.vehiclepassport.server.account.domain.model.Currency;
import com.vehiclepassport.server.account.domain.model.DistanceUnit;
import com.vehiclepassport.server.account.domain.model.Language;
import com.vehiclepassport.server.account.domain.model.NotificationPrefs;
import com.vehiclepassport.server.account.domain.model.Settings;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** Native SQL only: the smallint[] column has no portable JPA mapping, and the table has a single flat row per user. */
@ApplicationScoped
public class SettingsRepository implements SettingsPort {

    @Inject
    EntityManager em;

    @Override
    public Optional<Settings> find(UUID userId) {
        List<?> rows = em.createNativeQuery("select language, appearance, distance_unit, currency, "
                        + "notif_document_deadlines, array_to_string(notif_reminder_days, ','), notif_scans, "
                        + "notif_passport_views, notif_transfers, notif_product_news "
                        + "from vehicle_passport.user_settings where user_id = :id")
                .setParameter("id", userId)
                .getResultList();
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Object[] r = (Object[]) rows.get(0);
        String days = (String) r[5];
        List<Integer> reminderDays = days == null || days.isEmpty() ? List.of()
                : Arrays.stream(days.split(",")).map(Integer::valueOf).collect(Collectors.toList());
        return Optional.of(new Settings(Language.fromValue((String) r[0]), Appearance.fromValue((String) r[1]),
                DistanceUnit.fromValue((String) r[2]), Currency.fromValue((String) r[3]),
                new NotificationPrefs((Boolean) r[4], reminderDays, (Boolean) r[6], (Boolean) r[7], (Boolean) r[8],
                        (Boolean) r[9])));
    }

    @Override
    public void upsert(UUID userId, Settings s) {
        NotificationPrefs n = s.notifications();
        String days = n.reminderDays().stream().map(String::valueOf).collect(Collectors.joining(","));
        em.createNativeQuery("insert into vehicle_passport.user_settings (user_id, language, appearance, "
                        + "distance_unit, currency, notif_document_deadlines, notif_reminder_days, notif_scans, "
                        + "notif_passport_views, notif_transfers, notif_product_news) "
                        + "values (:id, :language, :appearance, :distance, :currency, :deadlines, "
                        + "cast(string_to_array(:days, ',') as smallint[]), :scans, :views, :transfers, :news) "
                        + "on conflict (user_id) do update set language = excluded.language, "
                        + "appearance = excluded.appearance, distance_unit = excluded.distance_unit, "
                        + "currency = excluded.currency, "
                        + "notif_document_deadlines = excluded.notif_document_deadlines, "
                        + "notif_reminder_days = excluded.notif_reminder_days, notif_scans = excluded.notif_scans, "
                        + "notif_passport_views = excluded.notif_passport_views, "
                        + "notif_transfers = excluded.notif_transfers, "
                        + "notif_product_news = excluded.notif_product_news")
                .setParameter("id", userId)
                .setParameter("language", s.language().value())
                .setParameter("appearance", s.appearance().value())
                .setParameter("distance", s.distance().value())
                .setParameter("currency", s.currency().value())
                .setParameter("deadlines", n.documentDeadlines())
                .setParameter("days", days)
                .setParameter("scans", n.activityScans())
                .setParameter("views", n.activityPassportViews())
                .setParameter("transfers", n.activityTransfers())
                .setParameter("news", n.productNews())
                .executeUpdate();
    }
}
