package com.vehiclepassport.server.scan.domain.model;

import com.vehiclepassport.server.scan.domain.exception.BatchTooLargeException;
import com.vehiclepassport.server.scan.domain.exception.FileTooLargeException;
import com.vehiclepassport.server.scan.domain.exception.UnsupportedFileException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Admission rules for uploaded receipts: declared type, size, magic bytes and batch size. */
public final class ScanFilePolicy {

    public static final long MAX_BYTES = 10_485_760L;
    public static final int MAX_BATCH = 20;

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] PDF = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "image/jpeg", JPEG,
            "image/png", PNG,
            "application/pdf", PDF);

    private ScanFilePolicy() {
    }

    public static void check(String contentType, long size, byte[] head) {
        byte[] signature = contentType == null ? null : SIGNATURES.get(contentType);
        if (signature == null) {
            throw new UnsupportedFileException("unsupported content type: " + contentType);
        }
        if (size > MAX_BYTES) {
            throw new FileTooLargeException("file exceeds " + MAX_BYTES + " bytes");
        }
        if (!startsWith(head, signature)) {
            throw new UnsupportedFileException("content does not match declared type " + contentType);
        }
    }

    public static void checkBatchSize(int n) {
        if (n < 1 || n > MAX_BATCH) {
            throw new BatchTooLargeException("batch must contain 1.." + MAX_BATCH + " files, got " + n);
        }
    }

    private static boolean startsWith(byte[] head, byte[] signature) {
        if (head == null || head.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (head[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
