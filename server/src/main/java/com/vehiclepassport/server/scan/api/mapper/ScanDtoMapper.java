package com.vehiclepassport.server.scan.api.mapper;

import com.vehiclepassport.server.scan.api.dto.ConfirmScanRequest;
import com.vehiclepassport.server.scan.api.dto.ScanBatchResponse;
import com.vehiclepassport.server.scan.api.dto.ScanFieldResponse;
import com.vehiclepassport.server.scan.api.dto.ScanFieldsResponse;
import com.vehiclepassport.server.scan.api.dto.ScanJobResponse;
import com.vehiclepassport.server.scan.api.dto.ScanPartResponse;
import com.vehiclepassport.server.scan.api.dto.ScanWarningResponse;
import com.vehiclepassport.server.scan.application.port.in.ConfirmScanCommand;
import com.vehiclepassport.server.scan.application.port.in.PartInput;
import com.vehiclepassport.server.scan.application.port.in.ScanBatchView;
import com.vehiclepassport.server.scan.application.port.in.ScanJobView;
import com.vehiclepassport.server.scan.domain.model.ExtractedField;
import com.vehiclepassport.server.scan.domain.model.ExtractedPart;
import com.vehiclepassport.server.scan.domain.model.ScanResult;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class ScanDtoMapper {

    private static final Map<String, String> MESSAGES = Map.of(
            "TOTAL_MISMATCH", "The total does not match the parts and labor",
            "ODOMETER_INCONSISTENT", "The odometer reading conflicts with the vehicle history",
            "DATE_IN_FUTURE", "The date is in the future");

    public ConfirmScanCommand toCommand(UUID userId, UUID jobId, ConfirmScanRequest r) {
        List<PartInput> parts = r.parts() == null ? List.of()
                : r.parts().stream().map(p -> new PartInput(p.name(), p.qty(), p.price())).toList();
        return new ConfirmScanCommand(userId, jobId, r.type(), r.date(), r.odometerKm(), r.serviceName(), parts,
                r.labor(), r.total(), r.currency(), r.notes());
    }

    public ScanJobResponse toResponse(ScanJobView v) {
        return new ScanJobResponse(v.id(), v.status(), toFields(v.result()),
                v.warnings().stream().map(w -> new ScanWarningResponse(w, MESSAGES.getOrDefault(w, w))).toList());
    }

    public ScanBatchResponse toResponse(ScanBatchView v) {
        return new ScanBatchResponse(v.jobs().stream().map(this::toResponse).toList());
    }

    private static ScanFieldsResponse toFields(ScanResult r) {
        if (r == null) {
            return null;
        }
        return new ScanFieldsResponse(field(r.serviceName()), field(r.date()), field(r.odometerKm()),
                partsField(r.parts()), field(r.labor()), field(r.total()));
    }

    private static ScanFieldResponse field(ExtractedField<?> f) {
        return f == null ? null : new ScanFieldResponse(f.value(), f.confidence());
    }

    private static ScanFieldResponse partsField(ExtractedField<List<ExtractedPart>> f) {
        if (f == null) {
            return null;
        }
        Object value = f.value() == null ? null
                : f.value().stream().map(p -> new ScanPartResponse(p.name(), p.qty(), p.price())).toList();
        return new ScanFieldResponse(value, f.confidence());
    }
}
