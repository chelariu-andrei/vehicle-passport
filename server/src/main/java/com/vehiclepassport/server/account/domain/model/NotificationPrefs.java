package com.vehiclepassport.server.account.domain.model;

import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import java.util.List;
import java.util.Set;

public record NotificationPrefs(
        boolean documentDeadlines,
        List<Integer> reminderDays,
        boolean tireSeason,
        boolean activityScans,
        boolean activityPassportViews,
        boolean activityTransfers,
        boolean productNews) {

    private static final Set<Integer> ALLOWED = Set.of(30, 7, 1);

    public NotificationPrefs {
        if (reminderDays == null) {
            throw new ValidationFailedException("reminderDays must not be null");
        }
        for (Integer d : reminderDays) {
            if (d == null || !ALLOWED.contains(d)) {
                throw new ValidationFailedException("reminderDays must be a subset of 30, 7, 1");
            }
        }
        if (Set.copyOf(reminderDays).size() != reminderDays.size()) {
            throw new ValidationFailedException("reminderDays must be unique");
        }
        reminderDays = List.copyOf(reminderDays);
    }

    public static NotificationPrefs defaults() {
        return new NotificationPrefs(true, List.of(30, 7, 1), true, true, true, true, false);
    }
}
