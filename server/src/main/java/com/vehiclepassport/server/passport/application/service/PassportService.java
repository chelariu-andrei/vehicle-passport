package com.vehiclepassport.server.passport.application.service;

import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportPdfUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportQrUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPublicPassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.ListMyPassportsUseCase;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.passport.application.port.in.PublicPassportView;
import com.vehiclepassport.server.passport.application.port.in.RevokePassportLinkUseCase;
import com.vehiclepassport.server.passport.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.passport.application.port.out.PassportDocument;
import com.vehiclepassport.server.passport.application.port.out.PassportRepositoryPort;
import com.vehiclepassport.server.passport.application.port.out.PdfRendererPort;
import com.vehiclepassport.server.passport.application.port.out.QrCodePort;
import com.vehiclepassport.server.passport.application.port.out.SnapshotSourcePort;
import com.vehiclepassport.server.passport.application.port.out.SnapshotSourcePort.SnapshotSource;
import com.vehiclepassport.server.passport.domain.exception.ExpiryInPastException;
import com.vehiclepassport.server.passport.domain.exception.PassportNotFoundException;
import com.vehiclepassport.server.passport.domain.model.LinkToken;
import com.vehiclepassport.server.passport.domain.model.Passport;
import com.vehiclepassport.server.passport.domain.model.PublicLink;
import com.vehiclepassport.server.passport.domain.model.Snapshot;
import com.vehiclepassport.server.shared.config.PassportConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class PassportService implements CreatePassportUseCase, RevokePassportLinkUseCase, ListMyPassportsUseCase,
        GetPublicPassportUseCase, GetPassportPdfUseCase, GetPassportQrUseCase {

    private static final String PDF_TYPE = "application/pdf";
    /** One text for unknown, revoked and expired links, so the cause cannot be told apart. */
    private static final String LINK_UNAVAILABLE = "Passport link not found";

    private final PassportRepositoryPort passports;
    private final SnapshotSourcePort source;
    private final PdfRendererPort pdf;
    private final QrCodePort qr;
    private final DocumentStoragePort storage;
    private final PassportConfig config;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    @Inject
    public PassportService(PassportRepositoryPort passports, SnapshotSourcePort source, PdfRendererPort pdf,
            QrCodePort qr, DocumentStoragePort storage, PassportConfig config, Clock clock) {
        this.passports = passports;
        this.source = source;
        this.pdf = pdf;
        this.qr = qr;
        this.storage = storage;
        this.config = config;
        this.clock = clock;
    }

    @Override
    @Transactional
    public PassportView create(UUID userId, String vin, Instant expiresAt) {
        SnapshotSource src = source.load(vin, userId);
        Instant now = clock.instant();
        if (expiresAt != null && !expiresAt.isAfter(now)) {
            throw new ExpiryInPastException("The expiry must be in the future");
        }
        Snapshot snapshot = Snapshot.of(src.vehicle(), src.events());
        UUID id = UUID.randomUUID();
        String token = LinkToken.generate(random);
        String url = publicUrl(token);
        byte[] rendered = pdf.render(
                new PassportDocument(src.vehicle(), src.events(), snapshot.hash(), url, qr.png(url)));
        String pdfKey = "passports/" + id + ".pdf";
        storage.put(pdfKey, rendered, PDF_TYPE);
        Passport passport = new Passport(id, src.vehicle().vin(), userId, now, snapshot,
                new PublicLink(token, expiresAt, null), pdfKey);
        passports.save(passport);
        return toView(passport, now);
    }

    @Override
    @Transactional
    public void revoke(UUID userId, UUID passportId) {
        Passport p = owned(userId, passportId);
        PublicLink revoked = p.link().revoke(clock.instant());
        if (revoked != p.link()) {
            passports.save(new Passport(p.id(), p.vin(), p.createdBy(), p.createdAt(), p.snapshot(), revoked,
                    p.pdfKey()));
        }
    }

    @Override
    @Transactional
    public List<PassportView> list(UUID userId) {
        Instant now = clock.instant();
        return passports.findByCreator(userId).stream()
                .sorted(Comparator.comparing(Passport::createdAt).reversed().thenComparing(Passport::id))
                .map(p -> toView(p, now)).toList();
    }

    @Override
    @Transactional
    public PublicPassportView get(String token) {
        Passport p = open(token);
        return new PublicPassportView(p.snapshot().canonicalJson(), p.snapshot().hash());
    }

    @Override
    @Transactional
    public byte[] publicPdf(String token) {
        return storage.read(open(token).pdfKey());
    }

    @Override
    @Transactional
    public byte[] ownerPdf(UUID userId, UUID passportId) {
        return storage.read(owned(userId, passportId).pdfKey());
    }

    @Override
    @Transactional
    public byte[] ownerQr(UUID userId, UUID passportId) {
        return qr.png(publicUrl(owned(userId, passportId).link().token()));
    }

    private Passport open(String token) {
        Instant now = clock.instant();
        return passports.findByToken(token)
                .filter(p -> p.link().isOpen(now))
                .orElseThrow(() -> new PassportNotFoundException(LINK_UNAVAILABLE));
    }

    private Passport owned(UUID userId, UUID passportId) {
        return passports.findById(passportId)
                .filter(p -> p.createdBy().equals(userId))
                .orElseThrow(() -> new PassportNotFoundException("Passport not found"));
    }

    private String publicUrl(String token) {
        return config.publicBaseUrl() + "/public/passports/" + token;
    }

    private PassportView toView(Passport p, Instant now) {
        return new PassportView(p.id(), p.vin(), publicUrl(p.link().token()), p.snapshot().hash(),
                p.status(now).name(), p.createdAt(), p.link().expiresAt());
    }
}
