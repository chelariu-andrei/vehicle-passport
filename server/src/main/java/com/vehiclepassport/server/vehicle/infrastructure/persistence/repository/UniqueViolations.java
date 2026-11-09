package com.vehiclepassport.server.vehicle.infrastructure.persistence.repository;

import java.sql.SQLException;

final class UniqueViolations {

    private static final String UNIQUE_VIOLATION = "23505";

    private UniqueViolations() {
    }

    static boolean isUniqueViolation(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && UNIQUE_VIOLATION.equals(sql.getSQLState())) {
                return true;
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return false;
    }
}
