package com.vehiclepassport.server.passport.application.port.out;

import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import java.util.List;

public record PassportDocument(SnapshotVehicle vehicle, List<SnapshotEvent> events, String hash, String publicUrl,
        byte[] qrPng) {
}
