package com.vehiclepassport.server.scan.api;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.vehiclepassport.server.scan.api.mapper.ScanDtoMapper;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.domain.model.ScanWarning;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class ScanDtoMapperTest {

    @ParameterizedTest
    @EnumSource(ScanWarning.class)
    void every_warning_has_a_human_message(ScanWarning w) {
        var view = new ScanJobView(UUID.randomUUID(), "EXTRACTED", null, List.of(w.name()));

        var response = new ScanDtoMapper().toResponse(view).warnings().get(0);

        assertNotEquals(w.name(), response.message());
    }
}
