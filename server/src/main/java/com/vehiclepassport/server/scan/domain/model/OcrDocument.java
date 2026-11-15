package com.vehiclepassport.server.scan.domain.model;

import java.util.List;

/** The OCR service's reading of one image: input size and the recognised lines. */
public record OcrDocument(int width, int height, List<OcrLine> lines) {

    public OcrDocument {
        if (lines == null) {
            throw new IllegalArgumentException("lines are required");
        }
        lines = List.copyOf(lines);
    }
}
