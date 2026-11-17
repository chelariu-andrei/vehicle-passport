package com.vehiclepassport.server.event.domain.model;

/** Discriminator of {@link EventDetails}. SCAN details come only from a confirmed scan. */
public enum DetailsKind {
    SCAN, INSURANCE, ROVINIETA, ITP, SAFETY_EQUIPMENT
}
