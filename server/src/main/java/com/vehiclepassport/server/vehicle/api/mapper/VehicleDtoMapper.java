package com.vehiclepassport.server.vehicle.api.mapper;

import com.vehiclepassport.server.vehicle.api.dto.ClaimFiledResponse;
import com.vehiclepassport.server.vehicle.api.dto.PendingClaimResponse;
import com.vehiclepassport.server.vehicle.api.dto.RegisterVehicleRequest;
import com.vehiclepassport.server.vehicle.api.dto.UpdateVehicleRequest;
import com.vehiclepassport.server.vehicle.api.dto.VehicleResponse;
import com.vehiclepassport.server.vehicle.application.port.in.PendingClaimView;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.ClaimFiled;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase.UpdateVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class VehicleDtoMapper {

    public RegisterVehicleCommand toCommand(UUID userId, RegisterVehicleRequest r) {
        return new RegisterVehicleCommand(userId, r.vin(), r.make(), r.model(), r.engine(), r.year(), r.fuel());
    }

    /** Overlays the given fields on the current vehicle. */
    public UpdateVehicleCommand toCommand(UUID userId, String vin, UpdateVehicleRequest r, VehicleView current) {
        return new UpdateVehicleCommand(userId, vin,
                r.make() != null ? r.make() : current.make(),
                r.model() != null ? r.model() : current.model(),
                r.engine() != null ? r.engine() : current.engine(),
                r.year() != null ? r.year() : current.year(),
                r.fuel() != null ? r.fuel() : current.fuel());
    }

    public VehicleResponse toResponse(VehicleView v) {
        return new VehicleResponse(v.vin(), v.make(), v.model(), v.engine(), v.year(), v.fuel());
    }

    public ClaimFiledResponse toResponse(ClaimFiled c) {
        return new ClaimFiledResponse(c.claimId(), c.filedAt());
    }

    public PendingClaimResponse toResponse(PendingClaimView c) {
        return new PendingClaimResponse(c.claimId(), c.filedAt());
    }
}
