package com.vehiclepassport.server.fuel.infrastructure.client;

import com.vehiclepassport.server.fuel.application.port.out.ClockPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;

/** Over the application {@link Clock} bean, so tests that swap the clock drive fuel too. */
@ApplicationScoped
public class SystemClockAdapter implements ClockPort {

    private final Clock clock;

    @Inject
    public SystemClockAdapter(Clock clock) {
        this.clock = clock;
    }

    @Override
    public LocalDate today() {
        return LocalDate.now(clock);
    }

    @Override
    public Instant now() {
        return clock.instant();
    }
}
