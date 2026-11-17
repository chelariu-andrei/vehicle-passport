package com.vehiclepassport.server.event.domain.model;

/**
 * The six car documents on the deadlines screen (deadlines spec §5.1). Declaration order is the response order.
 * Each maps one-to-one to a {@link ValidityGroup}; CASCO is the only optional one.
 */
public enum DocumentKind {
    ITP(ValidityGroup.ITP, false),
    RCA(ValidityGroup.RCA, false),
    CASCO(ValidityGroup.CASCO, true),
    ROVINIETA(ValidityGroup.ROVINIETA, false),
    FIRE_EXTINGUISHER(ValidityGroup.EXTINGUISHER, false),
    FIRST_AID_KIT(ValidityGroup.FIRST_AID, false);

    private final ValidityGroup group;
    private final boolean optional;

    DocumentKind(ValidityGroup group, boolean optional) {
        this.group = group;
        this.optional = optional;
    }

    public boolean optional() {
        return optional;
    }

    public ValidityGroup group() {
        return group;
    }
}
