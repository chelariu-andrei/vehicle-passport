package com.vehiclepassport.server.scan.application.port.out;

import java.time.LocalDate;

public interface OdometerCheckPort {

    boolean isConsistent(String vin, LocalDate date, int km);
}
