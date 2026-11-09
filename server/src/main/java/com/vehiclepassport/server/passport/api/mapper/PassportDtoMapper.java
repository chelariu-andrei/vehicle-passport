package com.vehiclepassport.server.passport.api.mapper;

import com.vehiclepassport.server.passport.api.dto.PassportResponse;
import com.vehiclepassport.server.passport.api.dto.PublicPassportResponse;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.passport.application.port.in.PublicPassportView;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class PassportDtoMapper {

    public PassportResponse toResponse(PassportView v) {
        return new PassportResponse(v.id(), v.vin(), v.publicUrl(), v.hash(), v.status(), v.createdAt(),
                v.expiresAt());
    }

    public PublicPassportResponse toResponse(PublicPassportView v) {
        return new PublicPassportResponse(v.snapshotJson(), v.hash(), PublicPassportResponse.SHA_256);
    }
}
