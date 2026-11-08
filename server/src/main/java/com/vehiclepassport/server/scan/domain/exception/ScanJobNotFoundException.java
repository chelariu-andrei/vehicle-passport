package com.vehiclepassport.server.scan.domain.exception;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;

public class ScanJobNotFoundException extends DomainException {

    public ScanJobNotFoundException() {
        super(ErrorKind.NOT_FOUND, "scan-not-found", "scan job not found");
    }
}
