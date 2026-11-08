package com.vehiclepassport.server.event.domain.model;

/** Odometer readings of the events immediately before and after a position on the timeline. */
public record Neighbours(Integer previousKm, Integer nextKm) {
}
