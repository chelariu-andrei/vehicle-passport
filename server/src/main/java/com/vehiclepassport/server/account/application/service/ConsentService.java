package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.CheckConsentUseCase;
import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.application.port.in.GetConsentStatusUseCase;
import com.vehiclepassport.server.account.application.port.in.ListConsentHistoryUseCase;
import com.vehiclepassport.server.account.application.port.in.RecordConsentUseCase;
import com.vehiclepassport.server.account.application.port.out.ConsentPort;
import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.domain.exception.ConsentVersionOutdatedException;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ConsentService implements GetConsentStatusUseCase, RecordConsentUseCase, ListConsentHistoryUseCase,
        CheckConsentUseCase {

    private final ConsentPort consents;
    private final LegalDocumentPort legal;
    private final Clock clock;

    @Inject
    public ConsentService(ConsentPort consents, LegalDocumentPort legal, Clock clock) {
        this.consents = consents;
        this.legal = legal;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ConsentStatus status(UUID userId) {
        return read(userId);
    }

    @Override
    @Transactional
    public boolean isCurrent(UUID userId) {
        return !read(userId).required();
    }

    @Override
    @Transactional
    public List<ConsentRecord> history(UUID userId) {
        return consents.history(userId);
    }

    @Override
    @Transactional
    public ConsentStatus record(UUID userId, ConsentChange change) {
        List<ConsentRecord> toAppend = new ArrayList<>();
        if (change.accept() != null) {
            for (ConsentAcceptance a : change.accept()) {
                String current = legal.currentVersion(legalType(a.type()));
                if (!current.equals(a.version())) {
                    throw new ConsentVersionOutdatedException("The current " + a.type().value() + " version is "
                            + current + ", not " + a.version());
                }
                toAppend.add(entry(userId, a.type(), a.version(), true, change));
            }
        }
        toggle(userId, ConsentType.MARKETING, change.marketing(), change, toAppend);
        toggle(userId, ConsentType.ANALYTICS, change.analytics(), change, toAppend);
        if (!toAppend.isEmpty()) {
            consents.append(toAppend);
        }
        return read(userId);
    }

    private void toggle(UUID userId, ConsentType type, Boolean wanted, ConsentChange change,
            List<ConsentRecord> out) {
        if (wanted != null && wanted != granted(userId, type)) {
            out.add(entry(userId, type, null, wanted, change));
        }
    }

    private boolean granted(UUID userId, ConsentType type) {
        return consents.latest(userId, type).map(ConsentRecord::granted).orElse(false);
    }

    private ConsentRecord entry(UUID userId, ConsentType type, String version, boolean granted,
            ConsentChange change) {
        return new ConsentRecord(UUID.randomUUID(), userId, null, type, version, granted, change.source(),
                clock.instant());
    }

    private ConsentStatus read(UUID userId) {
        return ConsentStatus.of(legal.currentVersion(LegalDocumentType.TERMS),
                legal.currentVersion(LegalDocumentType.PRIVACY), acceptedVersion(userId, ConsentType.TERMS),
                acceptedVersion(userId, ConsentType.PRIVACY), granted(userId, ConsentType.MARKETING),
                granted(userId, ConsentType.ANALYTICS));
    }

    private String acceptedVersion(UUID userId, ConsentType type) {
        return consents.latest(userId, type).filter(ConsentRecord::granted).map(ConsentRecord::version).orElse(null);
    }

    private static LegalDocumentType legalType(ConsentType type) {
        return switch (type) {
            case TERMS -> LegalDocumentType.TERMS;
            case PRIVACY -> LegalDocumentType.PRIVACY;
            default -> throw new ValidationFailedException("Only terms and privacy can be accepted by version");
        };
    }
}
