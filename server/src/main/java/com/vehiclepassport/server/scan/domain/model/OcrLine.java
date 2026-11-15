package com.vehiclepassport.server.scan.domain.model;

/** One recognised text line: its text, the recogniser's score (0..1) and its box. */
public record OcrLine(String text, double score, OcrBox box) {

    public OcrLine {
        if (text == null || box == null) {
            throw new IllegalArgumentException("text and box are required");
        }
        if (!(score >= 0.0 && score <= 1.0)) {
            throw new IllegalArgumentException("score must be within 0..1");
        }
    }
}
