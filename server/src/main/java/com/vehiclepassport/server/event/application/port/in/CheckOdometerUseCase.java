package com.vehiclepassport.server.event.application.port.in;

import java.time.LocalDate;

public interface CheckOdometerUseCase {

    boolean isConsistent(String vin, LocalDate date, int km);
}
