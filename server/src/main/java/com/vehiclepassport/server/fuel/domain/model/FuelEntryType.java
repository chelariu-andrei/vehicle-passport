package com.vehiclepassport.server.fuel.domain.model;

/** The physical fuel of one fill-up. */
public enum FuelEntryType {
    PETROL(FuelUnit.L), DIESEL(FuelUnit.L), LPG(FuelUnit.L), ELECTRIC(FuelUnit.KWH);

    private final FuelUnit unit;

    FuelEntryType(FuelUnit unit) {
        this.unit = unit;
    }

    public FuelUnit unit() {
        return unit;
    }

    /** Electric entries do not fit liquid-fuel cars and the other way round; hybrid and other take anything. */
    public boolean allowedFor(VehicleFuel vehicle) {
        return switch (vehicle) {
            case ELECTRIC -> this == ELECTRIC;
            case PETROL, DIESEL, LPG -> this != ELECTRIC;
            case HYBRID, OTHER -> true;
        };
    }
}
