package com.vehiclepassport.server.account.api.dto;

import java.util.List;

public record ConsentHistoryResponse(List<ConsentEventDto> items) {
}
