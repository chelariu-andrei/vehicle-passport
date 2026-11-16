package com.vehiclepassport.server.account.application.service;

import com.vehiclepassport.server.account.application.port.out.AccountErasurePort;
import com.vehiclepassport.server.account.application.port.out.IdentityAdminPort;
import com.vehiclepassport.server.account.application.port.out.OwnerDataEraserPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Purges one account in its own transaction. Every step is idempotent. The identity is deleted before the profile
 * row, and the profile row goes last: if the identity call fails the whole transaction rolls back and the profile is
 * still there for the next run; if the commit fails after the identity is gone, the next run sees "already deleted".
 */
@ApplicationScoped
public class SingleAccountPurgeService {

    /** Stands in for the owner on records that stay with a car after its owner is gone. */
    public static final UUID TOMBSTONE = new UUID(0L, 0L);

    private final OwnerDataEraserPort ownerData;
    private final AccountErasurePort erasure;
    private final IdentityAdminPort identity;

    @Inject
    public SingleAccountPurgeService(OwnerDataEraserPort ownerData, AccountErasurePort erasure, IdentityAdminPort identity) {
        this.ownerData = ownerData;
        this.erasure = erasure;
        this.identity = identity;
    }

    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void purge(UUID userId) {
        ownerData.revokePassports(userId);
        ownerData.detachOwnedData(userId, TOMBSTONE);
        erasure.anonymiseConsents(userId, sha256(userId));
        erasure.detachSupportReports(userId);
        erasure.deleteSettings(userId);
        identity.deleteUser(userId);
        erasure.deleteProfile(userId);
    }

    static String sha256(UUID userId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(userId.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
