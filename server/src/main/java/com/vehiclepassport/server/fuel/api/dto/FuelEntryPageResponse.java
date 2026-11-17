package com.vehiclepassport.server.fuel.api.dto;

import java.util.List;

/** The contract's {@code FuelEntryPage}; {@code nextCursor} is null on the last page. */
public record FuelEntryPageResponse(List<FuelEntryResponse> items, String nextCursor) {
}
