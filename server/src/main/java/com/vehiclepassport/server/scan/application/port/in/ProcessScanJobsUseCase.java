package com.vehiclepassport.server.scan.application.port.in;

public interface ProcessScanJobsUseCase {

    /** Runs one worker pass and returns the number of jobs it attempted to extract. */
    int processPending();
}
