package com.vehiclepassport.server.fuel.domain.model;

/** The vehicle's fuel as the fuel feature sees it (its own copy; the domain imports nothing from {@code vehicle}). */
public enum VehicleFuel { PETROL, DIESEL, HYBRID, ELECTRIC, LPG, OTHER }
