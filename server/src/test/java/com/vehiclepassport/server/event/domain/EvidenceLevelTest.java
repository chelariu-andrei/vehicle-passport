package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import org.junit.jupiter.api.Test;

class EvidenceLevelTest {

    @Test
    void ordering_is_estimated_userconfirmed_documented_verified() {
        EvidenceLevel[] ordered = {
            EvidenceLevel.ESTIMATED, EvidenceLevel.USER_CONFIRMED, EvidenceLevel.DOCUMENTED, EvidenceLevel.VERIFIED
        };
        for (int i = 0; i < ordered.length; i++) {
            for (int j = 0; j < ordered.length; j++) {
                if (i >= j) {
                    assertTrue(ordered[i].isAtLeast(ordered[j]), ordered[i] + " >= " + ordered[j]);
                } else {
                    assertFalse(ordered[i].isAtLeast(ordered[j]), ordered[i] + " < " + ordered[j]);
                }
            }
        }
    }
}
