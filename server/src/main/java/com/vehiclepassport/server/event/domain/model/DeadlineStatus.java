package com.vehiclepassport.server.event.domain.model;

/** Status of one car document (deadlines spec §5.2). NOT_RECORDED: no entry in the document's group. */
public enum DeadlineStatus {
    VALID, EXPIRING, EXPIRED, UNKNOWN, NOT_RECORDED
}
