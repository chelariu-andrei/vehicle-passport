package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;

public record CurrencyAmountView(String currency, BigDecimal amount) {
}
