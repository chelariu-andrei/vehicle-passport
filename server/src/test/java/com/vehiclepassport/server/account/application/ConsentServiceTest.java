package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.application.port.out.ConsentPort;
import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.application.service.ConsentService;
import com.vehiclepassport.server.account.domain.exception.ConsentVersionOutdatedException;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ConsentServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    private static final UUID OTHER = UUID.fromString("00000000-0000-0000-0000-0000000000c2");

    private final List<ConsentRecord> rows = new ArrayList<>();
    private final Map<LegalDocumentType, String> versions = new HashMap<>(
            Map.of(LegalDocumentType.TERMS, "1.0", LegalDocumentType.PRIVACY, "1.0", LegalDocumentType.DATA_SHARING, "1.0"));
    private Instant now = Instant.parse("2026-11-16T10:00:00Z");

    private final Clock clock = new Clock() {
        public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(java.time.ZoneId zone) { return this; }
        public Instant instant() { now = now.plus(Duration.ofSeconds(1)); return now; }
    };

    private final ConsentPort consents = new ConsentPort() {
        public void append(List<ConsentRecord> records) { rows.addAll(records); }

        public Optional<ConsentRecord> latest(UUID userId, ConsentType type) {
            return rows.stream().filter(r -> userId.equals(r.userId()) && r.type() == type)
                    .max(Comparator.comparing(ConsentRecord::createdAt));
        }

        public List<ConsentRecord> history(UUID userId) {
            return rows.stream().filter(r -> userId.equals(r.userId()))
                    .sorted(Comparator.comparing(ConsentRecord::createdAt).reversed()).toList();
        }
    };

    private final LegalDocumentPort legal = new LegalDocumentPort() {
        public Optional<LegalDocument> findCurrent(LegalDocumentType type, String locale) { return Optional.empty(); }

        public String currentVersion(LegalDocumentType type) { return versions.get(type); }
    };

    private final ConsentService service = new ConsentService(consents, legal, clock);

    private static ConsentChange acceptBoth(String terms, String privacy) {
        return new ConsentChange(List.of(new ConsentAcceptance(ConsentType.TERMS, terms),
                new ConsentAcceptance(ConsentType.PRIVACY, privacy)), null, null, ConsentSource.SIGN_UP_FORM);
    }

    @Test
    void newUserIsConsentRequired() {
        ConsentStatus status = service.status(USER);
        assertTrue(status.required());
        assertNull(status.terms().acceptedVersion());
        assertEquals("1.0", status.terms().currentVersion());
        assertFalse(status.marketing());
        assertFalse(status.analytics());
        assertFalse(service.isCurrent(USER));
    }

    @Test
    void acceptingCurrentVersionsClearsRequired() {
        ConsentStatus status = service.record(USER, acceptBoth("1.0", "1.0"));
        assertFalse(status.required());
        assertEquals("1.0", status.terms().acceptedVersion());
        assertTrue(service.isCurrent(USER));
        assertTrue(service.isCurrent(USER) && !service.isCurrent(OTHER));
    }

    @Test
    void acceptingOldVersionIs409ConsentVersionOutdatedAndWritesNothing() {
        versions.put(LegalDocumentType.TERMS, "2.0");
        assertThrows(ConsentVersionOutdatedException.class, () -> service.record(USER, acceptBoth("1.0", "1.0")));
        assertTrue(rows.isEmpty());
    }

    @Test
    void acceptingOnlyTheOutdatedHalfRecordsNeither() {
        versions.put(LegalDocumentType.PRIVACY, "2.0");
        assertThrows(ConsentVersionOutdatedException.class, () -> service.record(USER, acceptBoth("1.0", "1.0")));
        assertTrue(rows.isEmpty());
    }

    @Test
    void acceptingNonLegalTypeIsValidationFailed() {
        ConsentChange change = new ConsentChange(List.of(new ConsentAcceptance(ConsentType.MARKETING, "1.0")), null, null,
                ConsentSource.SETTINGS);
        assertThrows(ValidationFailedException.class, () -> service.record(USER, change));
    }

    @Test
    void historyIsAppendOnlyAndNewestFirst() {
        service.record(USER, acceptBoth("1.0", "1.0"));
        service.record(USER, new ConsentChange(null, true, null, ConsentSource.SETTINGS));
        List<ConsentRecord> history = service.history(USER);
        assertEquals(3, history.size());
        assertEquals(ConsentType.MARKETING, history.get(0).type());
        assertTrue(history.get(0).createdAt().isAfter(history.get(1).createdAt()));
        service.record(USER, acceptBoth("1.0", "1.0"));
        assertEquals(5, service.history(USER).size());
    }

    @Test
    void togglingMarketingOffRecordsGrantedFalse() {
        service.record(USER, new ConsentChange(null, true, null, ConsentSource.SETTINGS));
        assertTrue(service.status(USER).marketing());
        ConsentStatus off = service.record(USER, new ConsentChange(null, false, null, ConsentSource.SETTINGS));
        assertFalse(off.marketing());
        ConsentRecord last = service.history(USER).get(0);
        assertEquals(ConsentType.MARKETING, last.type());
        assertFalse(last.granted());
        assertNull(last.version());
    }

    @Test
    void unchangedToggleWritesNothing() {
        service.record(USER, new ConsentChange(null, false, false, ConsentSource.SETTINGS));
        assertTrue(rows.isEmpty());
        service.record(USER, new ConsentChange(null, true, null, ConsentSource.SETTINGS));
        service.record(USER, new ConsentChange(null, true, null, ConsentSource.SETTINGS));
        assertEquals(1, rows.size());
    }

    @Test
    void bumpingTermsVersionRequiresReconsent() {
        service.record(USER, acceptBoth("1.0", "1.0"));
        versions.put(LegalDocumentType.TERMS, "2.0");
        ConsentStatus status = service.status(USER);
        assertTrue(status.required());
        assertEquals("1.0", status.terms().acceptedVersion());
        assertEquals("2.0", status.terms().currentVersion());
        assertFalse(service.isCurrent(USER));
        assertFalse(service.record(USER, acceptBoth("2.0", "1.0")).required());
    }

    @Test
    void recordsAreStampedWithUserSourceAndClock() {
        service.record(USER, acceptBoth("1.0", "1.0"));
        ConsentRecord r = rows.get(0);
        assertEquals(USER, r.userId());
        assertNull(r.subjectHash());
        assertTrue(r.granted());
        assertEquals(ConsentSource.SIGN_UP_FORM, r.source());
        assertEquals("1.0", r.version());
    }
}
