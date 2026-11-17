package com.vehiclepassport.server.fuel.application.port.out;

import java.time.LocalDate;

/** Whether a reading fits the car's recorded event history (the one-way link to {@code event}). */
public interface OdometerCheckPort {

    boolean isConsistent(String vin, LocalDate date, int km);
}
