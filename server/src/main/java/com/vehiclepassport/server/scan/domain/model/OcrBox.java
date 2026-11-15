package com.vehiclepassport.server.scan.domain.model;

/** Axis-aligned bounding box of one OCR line, in image pixels. */
public record OcrBox(int xMin, int yMin, int xMax, int yMax) {

    public OcrBox {
        if (xMin > xMax || yMin > yMax) {
            throw new IllegalArgumentException("box min must not exceed max");
        }
    }

    public int height() {
        return yMax - yMin;
    }

    public double centerY() {
        return (yMin + (double) yMax) / 2.0;
    }
}
