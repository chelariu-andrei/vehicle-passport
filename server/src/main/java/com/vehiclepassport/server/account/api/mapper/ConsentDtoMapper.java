package com.vehiclepassport.server.account.api.mapper;

import com.vehiclepassport.server.account.api.dto.ConsentEventDto;
import com.vehiclepassport.server.account.api.dto.ConsentHistoryResponse;
import com.vehiclepassport.server.account.api.dto.ConsentStatusDto;
import com.vehiclepassport.server.account.api.dto.ConsentUpdateRequest;
import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class ConsentDtoMapper {

    public ConsentChange toChange(ConsentUpdateRequest r) {
        List<ConsentAcceptance> accept = r.accept() == null ? List.of()
                : r.accept().stream().map(a -> new ConsentAcceptance(ConsentType.fromValue(a.type()), a.version()))
                        .toList();
        return new ConsentChange(accept, r.marketing(), r.analytics(), ConsentSource.fromValue(r.source()));
    }

    public ConsentStatusDto toDto(ConsentStatus s) {
        return new ConsentStatusDto(s.required(),
                new ConsentStatusDto.VersionState(s.terms().currentVersion(), s.terms().acceptedVersion()),
                new ConsentStatusDto.VersionState(s.privacy().currentVersion(), s.privacy().acceptedVersion()),
                s.marketing(), s.analytics());
    }

    public ConsentEventDto toDto(ConsentRecord r) {
        return new ConsentEventDto(r.type().value(), r.version(), r.granted(), r.source().value(), r.createdAt());
    }

    public ConsentHistoryResponse toHistory(List<ConsentRecord> records) {
        return new ConsentHistoryResponse(records.stream().map(this::toDto).toList());
    }
}
