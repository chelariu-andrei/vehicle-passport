package com.vehiclepassport.server.scan.domain.model;

public enum ScanWarning {
    TOTAL_MISMATCH,
    ODOMETER_INCONSISTENT,
    DATE_IN_FUTURE,
    LOW_CONFIDENCE_READ,
    TOTALS_INCONSISTENT,
    PART_ROW_SKIPPED,
    PART_LINE_MISMATCH
}
