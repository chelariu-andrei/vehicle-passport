package com.vehiclepassport.server.account.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record AccountExportResponse(
        Instant exportedAt,
        MeResponse profile,
        SettingsDto settings,
        List<ConsentEventDto> consents,
        List<Map<String, Object>> vehicles,
        List<Map<String, Object>> events,
        List<Map<String, Object>> passports) {
}
