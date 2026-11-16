package com.vehiclepassport.server.account.api.dto;

import java.time.Instant;

public record DeletionStatusDto(Instant scheduledFor) {
}
