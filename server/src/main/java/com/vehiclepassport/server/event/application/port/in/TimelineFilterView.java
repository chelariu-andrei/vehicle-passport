package com.vehiclepassport.server.event.application.port.in;

import java.time.LocalDate;
import java.util.List;

/**
 * Timeline filter as the caller states it. Types and components are names from the contract enums; null or empty
 * lists and null dates mean no restriction. The application refuses unknown names and a period with from after to.
 */
public record TimelineFilterView(List<String> types, List<String> components, LocalDate from, LocalDate to) {
}
