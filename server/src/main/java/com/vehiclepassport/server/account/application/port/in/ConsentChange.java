package com.vehiclepassport.server.account.application.port.in;

import com.vehiclepassport.server.account.domain.model.ConsentSource;
import java.util.List;

/** One consent update. {@code accept} may be null or empty; a null toggle means "leave as is". */
public record ConsentChange(List<ConsentAcceptance> accept, Boolean marketing, Boolean analytics,
        ConsentSource source) {
}
