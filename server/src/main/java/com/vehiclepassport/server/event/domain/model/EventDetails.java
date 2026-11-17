package com.vehiclepassport.server.event.domain.model;

/** Typed details of an event, one record per {@link DetailsKind}. The kind must match the event type's rule. */
public sealed interface EventDetails
        permits ScanDetails, InsuranceDetails, RovinietaDetails, ItpDetails, SafetyEquipmentDetails {

    DetailsKind kind();
}