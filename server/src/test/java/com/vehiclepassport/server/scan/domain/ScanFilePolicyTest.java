package com.vehiclepassport.server.scan.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.scan.domain.exception.BatchTooLargeException;
import com.vehiclepassport.server.scan.domain.exception.FileTooLargeException;
import com.vehiclepassport.server.scan.domain.exception.UnsupportedFileException;
import com.vehiclepassport.server.scan.domain.model.ScanFilePolicy;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ScanFilePolicyTest {

    private static final byte[] JPEG_HEAD = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
    private static final byte[] PNG_HEAD = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00};
    private static final byte[] PDF_HEAD = "%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] GIF_HEAD = "GIF89a".getBytes(StandardCharsets.US_ASCII);

    @Test
    void accepts_jpeg_png_pdf() {
        assertDoesNotThrow(() -> ScanFilePolicy.check("image/jpeg", 100, JPEG_HEAD));
        assertDoesNotThrow(() -> ScanFilePolicy.check("image/png", 100, PNG_HEAD));
        assertDoesNotThrow(() -> ScanFilePolicy.check("application/pdf", 100, PDF_HEAD));
    }

    @Test
    void exactly_10MB_passes() {
        assertDoesNotThrow(() -> ScanFilePolicy.check("image/jpeg", ScanFilePolicy.MAX_BYTES, JPEG_HEAD));
    }

    @Test
    void one_byte_over_throws_file_too_large() {
        FileTooLargeException ex = assertThrows(FileTooLargeException.class,
                () -> ScanFilePolicy.check("image/jpeg", ScanFilePolicy.MAX_BYTES + 1, JPEG_HEAD));

        assertEquals("file-too-large", ex.code());
        assertEquals(com.vehiclepassport.server.shared.error.ErrorKind.TOO_LARGE, ex.kind());
    }

    @Test
    void declared_gif_throws() {
        UnsupportedFileException ex = assertThrows(UnsupportedFileException.class,
                () -> ScanFilePolicy.check("image/gif", 100, GIF_HEAD));

        assertEquals("unsupported-file", ex.code());
        assertEquals(com.vehiclepassport.server.shared.error.ErrorKind.UNSUPPORTED_MEDIA, ex.kind());
    }

    @Test
    void declared_png_with_pdf_bytes_throws() {
        assertThrows(UnsupportedFileException.class,
                () -> ScanFilePolicy.check("image/png", 100, PDF_HEAD));
    }

    @Test
    void empty_head_throws() {
        assertThrows(UnsupportedFileException.class,
                () -> ScanFilePolicy.check("image/png", 0, new byte[0]));
    }

    @Test
    void batch_20_passes() {
        assertDoesNotThrow(() -> ScanFilePolicy.checkBatchSize(20));
    }

    @Test
    void batch_21_throws() {
        BatchTooLargeException ex = assertThrows(BatchTooLargeException.class,
                () -> ScanFilePolicy.checkBatchSize(21));

        assertEquals("batch-too-large", ex.code());
        assertEquals(com.vehiclepassport.server.shared.error.ErrorKind.UNPROCESSABLE, ex.kind());
    }

    @Test
    void batch_0_throws() {
        assertThrows(BatchTooLargeException.class, () -> ScanFilePolicy.checkBatchSize(0));
    }
}
