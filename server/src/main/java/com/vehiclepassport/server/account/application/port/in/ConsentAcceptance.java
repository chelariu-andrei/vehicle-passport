package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentType;

public record ConsentAcceptance(ConsentType type, String version) {
}
