package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.OdometerInconsistentException;

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
