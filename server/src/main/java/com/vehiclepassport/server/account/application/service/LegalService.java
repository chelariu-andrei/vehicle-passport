package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.GetLegalDocumentUseCase;
import com.vehiclepassport.server.account.application.port.in.ListLegalDocumentsUseCase;
import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.domain.exception.LegalDocumentNotFoundException;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@ApplicationScoped
public class LegalService implements GetLegalDocumentUseCase, ListLegalDocumentsUseCase {

    private static final String FALLBACK = "en";

    private final LegalDocumentPort documents;

    @Inject
    public LegalService(LegalDocumentPort documents) {
        this.documents = documents;
    }

    @Override
    public LegalDocument get(LegalDocumentType type, String locale) {
        return find(type, locale).orElseThrow(
                () -> new LegalDocumentNotFoundException("No current legal document of type " + type.value()));
    }

    @Override
    public List<LegalDocument> list(String locale) {
        return Arrays.stream(LegalDocumentType.values())
                .map(type -> find(type, locale))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<LegalDocument> find(LegalDocumentType type, String locale) {
        String wanted = locale == null ? FALLBACK : locale.trim().toLowerCase(Locale.ROOT);
        Optional<LegalDocument> hit = wanted.equals(FALLBACK) ? Optional.empty() : documents.findCurrent(type, wanted);
        return hit.isPresent() ? hit : documents.findCurrent(type, FALLBACK);
    }
}
