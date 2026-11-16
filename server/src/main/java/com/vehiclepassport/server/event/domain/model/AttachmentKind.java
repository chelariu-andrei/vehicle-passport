package com.vehiclepassport.server.event.domain.model;

/** SCAN_SOURCE comes from a confirmed scan and cannot be deleted; UPLOAD is added by the owner. */
public enum AttachmentKind {
    SCAN_SOURCE,
    UPLOAD
}
