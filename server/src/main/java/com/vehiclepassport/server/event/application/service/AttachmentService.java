package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.AddAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.AttachmentUpload;
import com.vehiclepassport.server.event.application.port.in.AttachmentView;
import com.vehiclepassport.server.event.application.port.in.DeleteAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.in.GetEventDocumentUseCase;
import com.vehiclepassport.server.event.application.port.in.ListAttachmentsUseCase;
import com.vehiclepassport.server.event.application.port.in.OpenAttachmentUseCase;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.event.domain.exception.AttachmentLimitException;
import com.vehiclepassport.server.event.domain.exception.AttachmentNotFoundException;
import com.vehiclepassport.server.event.domain.exception.AttachmentProtectedException;
import com.vehiclepassport.server.event.domain.exception.DocumentRestrictedException;
import com.vehiclepassport.server.event.domain.exception.DuplicateDocumentException;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.event.domain.exception.PriorPeriodEventException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.shared.error.FileTooLargeException;
import com.vehiclepassport.server.shared.util.UploadPolicy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Attachments of an event. Every call needs the active owner and an event created in the active ownership period.
 * Attachments never change the event itself (its evidence stays as it is).
 */
@ApplicationScoped
public class AttachmentService implements AddAttachmentUseCase, ListAttachmentsUseCase, OpenAttachmentUseCase,
        DeleteAttachmentUseCase, GetEventDocumentUseCase {

    public static final int MAX_PER_EVENT = 10;

    private static final Logger LOG = Logger.getLogger(AttachmentService.class);
    private static final int HEAD_BYTES = 8;
    private static final int BUFFER_BYTES = 8192;
    private static final String OCTET_STREAM = "application/octet-stream";

    private final EventRepositoryPort events;
    private final ActiveOwnerPort owners;
    private final AttachmentRepositoryPort attachments;
    private final DocumentStoragePort storage;
    private final Clock clock;

    @Inject
    public AttachmentService(EventRepositoryPort events, ActiveOwnerPort owners,
            AttachmentRepositoryPort attachments, DocumentStoragePort storage, Clock clock) {
        this.events = events;
        this.owners = owners;
        this.attachments = attachments;
        this.storage = storage;
        this.clock = clock;
    }

    /**
     * Order: active owner (404) → event exists (404) → active period (403) → limit (422) → file policy on the
     * declared type/size and the first bytes (415/413) → stream to a temp file hashing the raw bytes and counting
     * them (413) → under the VIN timeline lock: re-check event and limit, duplicate (409) → put object → insert
     * row. If anything fails after the put, the object is deleted again.
     */
    @Override
    @Transactional
    public AttachmentView add(UUID userId, String vin, UUID eventId, AttachmentUpload file) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        checkWritable(owned, eventId);
        InputStream in = file.content();
        byte[] head = readHead(in);
        UploadPolicy.check(file.contentType(), file.declaredSize(), head);
        Path temp = createTemp();
        try {
            Hashed hashed = copyHashing(head, in, temp);
            // Checks before the lock only fail fast; these are authoritative (an event delete or a concurrent
            // add may have committed while this upload was streaming).
            events.lockTimeline(owned.vin());
            checkWritable(owned, eventId);
            attachments.findLiveUploadByHash(owned.vin(), hashed.sha256()).ifPresent(existing -> {
                throw new DuplicateDocumentException(existing.eventId());
            });
            UUID id = UUID.randomUUID();
            Attachment attachment = new Attachment(id, eventId, owned.vin(), hashed.sha256(), file.contentType(),
                    hashed.size(), storageKey(owned.vin(), id), AttachmentKind.UPLOAD, userId, clock.instant(),
                    null);
            storage.put(attachment.storageKey(), temp, attachment.contentType());
            try {
                // A concurrent identical upload makes this throw DuplicateDocumentException (unique index).
                attachments.save(attachment);
            } catch (RuntimeException e) {
                removeObject(attachment.storageKey(), e);
                throw e;
            }
            return toView(attachment);
        } finally {
            deleteTemp(temp);
        }
    }

    @Override
    @Transactional
    public List<AttachmentView> list(UUID userId, String vin, UUID eventId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        VehicleEvent event = findEvent(owned, eventId);
        if (!owned.periodId().equals(event.periodId())) {
            throw new DocumentRestrictedException("The documents are restricted to the owner who added them");
        }
        return attachments.liveFor(eventId).stream().map(this::withRealType).map(AttachmentService::toView).toList();
    }

    /**
     * Order: active owner (404) → event exists (404) → attachment exists (404) → active period (403
     * document-restricted), like the event document. Legacy rows are stored as application/octet-stream; their
     * real type comes from the storage object or, failing that, from the file's magic bytes.
     */
    @Override
    @Transactional
    public EventDocument open(UUID userId, String vin, UUID eventId, UUID attachmentId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        VehicleEvent event = findEvent(owned, eventId);
        Attachment attachment = findAttachment(eventId, attachmentId);
        if (!owned.periodId().equals(event.periodId())) {
            throw new DocumentRestrictedException("The document is restricted to the owner who added it");
        }
        return read(attachment);
    }

    /**
     * The deprecated event document: the event's first live attachment (oldest first). Order: active owner (404)
     * → event exists (404) → event has an attachment (404 event-not-found) → active period (403
     * document-restricted). Later owners see that a document exists but cannot open it.
     */
    @Override
    @Transactional
    public EventDocument get(UUID userId, String vin, UUID eventId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        VehicleEvent event = findEvent(owned, eventId);
        Attachment first = attachments.liveFor(eventId).stream().findFirst()
                .orElseThrow(() -> new EventNotFoundException("Event " + eventId + " has no document"));
        if (!owned.periodId().equals(event.periodId())) {
            throw new DocumentRestrictedException("The document is restricted to the owner who added it");
        }
        return read(first);
    }

    private EventDocument read(Attachment attachment) {
        EventDocument doc = storage.open(attachment.storageKey());
        if (isSpecific(attachment.contentType())) {
            return new EventDocument(doc.content(), attachment.contentType());
        }
        if (isSpecific(doc.contentType())) {
            return doc;
        }
        return sniffed(doc.content());
    }

    /**
     * Legacy scan sources were backfilled as application/octet-stream; their real type is read from storage (the
     * object's type or its magic bytes) so the API never reports octet-stream. If the object cannot be read the
     * row is listed as it is stored.
     */
    private Attachment withRealType(Attachment a) {
        if (isSpecific(a.contentType())) {
            return a;
        }
        String type;
        try {
            EventDocument doc = read(a);
            try (InputStream ignored = doc.content()) {
                type = doc.contentType();
            }
        } catch (IOException | RuntimeException e) {
            LOG.warnf(e, "Could not determine the content type of attachment %s", a.id());
            return a;
        }
        return new Attachment(a.id(), a.eventId(), a.vin(), a.sha256(), type, a.sizeBytes(), a.storageKey(),
                a.kind(), a.createdBy(), a.createdAt(), a.deletedAt());
    }

    @Override
    @Transactional
    public void delete(UUID userId, String vin, UUID eventId, UUID attachmentId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        events.lockTimeline(owned.vin());
        checkPeriod(owned, findEvent(owned, eventId));
        Attachment attachment = findAttachment(eventId, attachmentId);
        if (attachment.kind() == AttachmentKind.SCAN_SOURCE) {
            throw new AttachmentProtectedException("The source document of a confirmed scan cannot be removed");
        }
        // Soft delete: the object stays in storage, the hash is free for a new upload.
        attachments.softDelete(attachment.id(), clock.instant());
    }

    private void checkWritable(OwnedPeriod owned, UUID eventId) {
        checkPeriod(owned, findEvent(owned, eventId));
        if (attachments.countLive(eventId) >= MAX_PER_EVENT) {
            throw new AttachmentLimitException("An event can hold at most " + MAX_PER_EVENT + " attachments");
        }
    }

    private VehicleEvent findEvent(OwnedPeriod owned, UUID eventId) {
        return events.findActive(owned.vin(), eventId)
                .orElseThrow(() -> new EventNotFoundException("Event " + eventId + " not found"));
    }

    private static void checkPeriod(OwnedPeriod owned, VehicleEvent event) {
        if (!owned.periodId().equals(event.periodId())) {
            throw new PriorPeriodEventException("Event was created during an earlier ownership period");
        }
    }

    private Attachment findAttachment(UUID eventId, UUID attachmentId) {
        return attachments.findLive(eventId, attachmentId)
                .orElseThrow(() -> new AttachmentNotFoundException("Attachment " + attachmentId + " not found"));
    }

    private void removeObject(String key, RuntimeException cause) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            cause.addSuppressed(e);
            LOG.warnf(e, "Could not remove orphaned attachment object %s", key);
        }
    }

    private static String storageKey(String vin, UUID id) {
        return "attachments/" + vin + "/" + id;
    }

    private static byte[] readHead(InputStream in) {
        try {
            return in.readNBytes(HEAD_BYTES);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Writes head + rest to the file, hashing and counting the raw bytes; stops once past the size limit. */
    private static Hashed copyHashing(byte[] head, InputStream rest, Path target) {
        MessageDigest digest = sha256();
        long size = 0;
        try (OutputStream out = new DigestOutputStream(Files.newOutputStream(target), digest)) {
            out.write(head);
            size += head.length;
            byte[] buffer = new byte[BUFFER_BYTES];
            int n;
            while (size <= UploadPolicy.MAX_BYTES && (n = rest.read(buffer)) != -1) {
                out.write(buffer, 0, n);
                size += n;
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (size > UploadPolicy.MAX_BYTES) {
            throw new FileTooLargeException("file exceeds " + UploadPolicy.MAX_BYTES + " bytes");
        }
        return new Hashed(HexFormat.of().formatHex(digest.digest()), size);
    }

    private static EventDocument sniffed(InputStream content) {
        BufferedInputStream buffered = new BufferedInputStream(content);
        try {
            buffered.mark(HEAD_BYTES);
            byte[] head = buffered.readNBytes(HEAD_BYTES);
            buffered.reset();
            // Every stored file passed the upload policy, so only corrupted content falls back here.
            return new EventDocument(buffered, UploadPolicy.sniff(head).orElse(OCTET_STREAM));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static boolean isSpecific(String contentType) {
        return contentType != null && !contentType.isBlank() && !OCTET_STREAM.equalsIgnoreCase(contentType);
    }

    private static Path createTemp() {
        try {
            return Files.createTempFile("attachment-", ".upload");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void deleteTemp(Path temp) {
        try {
            Files.deleteIfExists(temp);
        } catch (IOException e) {
            LOG.warnf(e, "Could not delete temp file %s", temp);
        }
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private static AttachmentView toView(Attachment a) {
        return new AttachmentView(a.id(), a.contentType(), a.sizeBytes(), a.sha256(), a.kind().name(),
                a.createdAt());
    }

    private record Hashed(String sha256, long size) {
    }
}
