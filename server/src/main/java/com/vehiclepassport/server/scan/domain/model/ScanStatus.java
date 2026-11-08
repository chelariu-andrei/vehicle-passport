package com.vehiclepassport.server.scan.domain.model;

public enum ScanStatus {
    PENDING,
    PROCESSING,
    EXTRACTED,
    CONFIRMED,
    REJECTED,
    FAILED,
    CANCELLED
}
