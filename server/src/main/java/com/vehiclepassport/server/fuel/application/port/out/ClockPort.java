package com.vehiclepassport.server.fuel.application.port.out;

import java.time.Instant;
import java.time.LocalDate;

public interface ClockPort {

    LocalDate today();

    Instant now();
}
