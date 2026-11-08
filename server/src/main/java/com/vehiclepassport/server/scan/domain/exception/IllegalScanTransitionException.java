package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.scan.domain.model.ScanStatus;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class IllegalScanTransitionException extends DomainException {

    public IllegalScanTransitionException(ScanStatus from, String action) {
        super(ErrorKind.CONFLICT, "scan-state-conflict",
                "cannot " + action + " a scan job in status " + from);
    }
}
