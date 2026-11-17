package com.vehiclepassport.server.fuel.domain.model;

import com.vehiclepassport.server.fuel.domain.exception.OdometerInconsistentException;

/** The fuel feature's copy of the odometer rule ({@code event}'s domain is not imported). */
public final class OdometerPolicy {

    private OdometerPolicy() {
    }

    /** Passes when previousKm <= km <= nextKm; a null bound is open. */
    public static void check(Integer previousKm, int km, Integer nextKm) {
        if (previousKm != null && km < previousKm) {
            throw new OdometerInconsistentException(
                    "Odometer " + km + " km is below " + previousKm + " km recorded earlier");
        }
        if (nextKm != null && km > nextKm) {
            throw new OdometerInconsistentException(
                    "Odometer " + km + " km is above " + nextKm + " km recorded later");
        }
    }
}
