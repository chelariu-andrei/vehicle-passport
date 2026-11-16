package com.vehiclepassport.server.account.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.account.application.port.out.LegalDocumentPort;
import com.vehiclepassport.server.account.application.service.LegalService;
import com.vehiclepassport.server.account.domain.exception.LegalDocumentNotFoundException;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LegalServiceTest {

    private static LegalDocument doc(LegalDocumentType type, String locale, String version) {
        return new LegalDocument(type, version, locale, type.value() + "-" + locale, "body", LocalDate.parse("2026-01-01"));
    }

    private final List<LegalDocument> current = List.of(
            doc(LegalDocumentType.TERMS, "en", "2.0"), doc(LegalDocumentType.TERMS, "ro", "2.0"),
            doc(LegalDocumentType.PRIVACY, "en", "1.0"), doc(LegalDocumentType.DATA_SHARING, "en", "1.0"));

    private final LegalDocumentPort port = new LegalDocumentPort() {
        @Override
        public Optional<LegalDocument> findCurrent(LegalDocumentType type, String locale) {
            return current.stream().filter(d -> d.type() == type && d.locale().equals(locale)).findFirst();
        }

        @Override
        public String currentVersion(LegalDocumentType type) {
            return findCurrent(type, "en").orElseThrow().version();
        }
    };

    private final LegalService service = new LegalService(port);

    @Test
    void listReturnsOneCurrentDocumentPerTypeInFixedOrder() {
        List<LegalDocument> docs = service.list("en");
        assertEquals(List.of(LegalDocumentType.TERMS, LegalDocumentType.PRIVACY, LegalDocumentType.DATA_SHARING),
                docs.stream().map(LegalDocument::type).toList());
    }

    @Test
    void listFallsBackPerTypeWhenLocaleLacksText() {
        List<LegalDocument> docs = service.list("ro");
        assertEquals(List.of("ro", "en", "en"), docs.stream().map(LegalDocument::locale).toList());
    }

    @Test
    void getReturnsRomanianWhenRequested() {
        assertEquals("ro", service.get(LegalDocumentType.TERMS, "ro").locale());
    }

    @Test
    void getFallsBackToEnglishForUnknownOrNullLocale() {
        assertEquals("en", service.get(LegalDocumentType.TERMS, "fr").locale());
        assertEquals("en", service.get(LegalDocumentType.TERMS, null).locale());
    }

    @Test
    void getFallsBackToEnglishWhenRomanianMissing() {
        assertEquals("en", service.get(LegalDocumentType.PRIVACY, "ro").locale());
    }

    @Test
    void getThrowsNotFoundWhenNoTextAtAll() {
        LegalService empty = new LegalService(new LegalDocumentPort() {
            public Optional<LegalDocument> findCurrent(LegalDocumentType t, String l) { return Optional.empty(); }
            public String currentVersion(LegalDocumentType t) { throw new IllegalStateException(); }
        });
        assertThrows(LegalDocumentNotFoundException.class, () -> empty.get(LegalDocumentType.TERMS, "en"));
    }
}
