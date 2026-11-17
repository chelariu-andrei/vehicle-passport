package com.vehiclepassport.server.event.domain.model;

/** The entries that replace one another (spec §5.6): only the newest entry of a group is current. */
public enum ValidityGroup {
    RCA, CASCO, ROVINIETA, ITP, EXTINGUISHER, FIRST_AID
}
