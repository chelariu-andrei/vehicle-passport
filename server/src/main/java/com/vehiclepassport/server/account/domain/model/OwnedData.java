package com.vehiclepassport.server.account.domain.model;

import java.util.List;
import java.util.Map;

/** What the other features hold for an owner, as plain maps keyed by the contract's field names. */
public record OwnedData(List<Map<String, Object>> vehicles, List<Map<String, Object>> events,
        List<Map<String, Object>> passports, List<Map<String, Object>> fuelEntries) {
}
