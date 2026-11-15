package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.account.application.port.out.ConsentStatusReaderPort;
import com.vehiclepassport.server.account.domain.model.ConsentStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeConsentStatusReader implements ConsentStatusReaderPort {

    @Override
    public ConsentStatus read(UUID userId) {
        return ConsentStatus.of("1.0", "1.0", null, null, false, false);
    }
}
