package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.in.CheckErasedAccountUseCase;
import com.vehiclepassport.server.account.application.port.out.ErasedAccountPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

@ApplicationScoped
public class ErasedAccountService implements CheckErasedAccountUseCase {

    private final ErasedAccountPort erased;

    @Inject
    public ErasedAccountService(ErasedAccountPort erased) {
        this.erased = erased;
    }

    @Override
    @Transactional
    public boolean isErased(UUID userId) {
        return erased.isErased(userId);
    }
}
