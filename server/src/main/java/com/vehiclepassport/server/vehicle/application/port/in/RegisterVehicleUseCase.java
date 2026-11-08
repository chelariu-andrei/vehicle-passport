package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface RegisterVehicleUseCase {

    RegistrationResult register(RegisterVehicleCommand command);

    record RegisterVehicleCommand(
            UUID userId, String vin, String make, String model, String engine, int year, String fuel) {
    }

    sealed interface RegistrationResult permits Registered, ClaimFiled {
    }

    record Registered(VehicleView vehicle) implements RegistrationResult {
    }

    record ClaimFiled(UUID claimId) implements RegistrationResult {
    }
}
