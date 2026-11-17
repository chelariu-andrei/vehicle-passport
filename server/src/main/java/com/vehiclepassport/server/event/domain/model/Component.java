package com.vehiclepassport.server.event.domain.model;

/** What part of the car an event touches. Stored sorted (declaration order); the server applies no defaults. */
public enum Component {
    ENGINE, TRANSMISSION, BRAKES, SUSPENSION, STEERING, TIRES_WHEELS, ELECTRICAL, CLIMATE, BODY, EXHAUST, INTERIOR,
    FLUIDS, OTHER
}
