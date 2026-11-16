package com.vehiclepassport.server.account.application.port.in;

import java.util.Optional;

/** Empty means unchanged; an empty string clears the field. */
public record ProfileChange(Optional<String> displayName, Optional<String> phone) {
}
