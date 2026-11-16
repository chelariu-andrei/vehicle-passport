package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;

import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.application.port.in.RecordConsentUseCase;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class ExportIT {

    static final String OWNER = "00000000-0000-0000-0000-00000000b001";
    static final String BYSTANDER = "00000000-0000-0000-0000-00000000b002";
    static final String EMPTY = "00000000-0000-0000-0000-00000000b003";

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AddEventUseCase adding;
    @Inject
    CreatePassportUseCase passports;
    @Inject
    RecordConsentUseCase consents;

    private static String randomVin() {
        String alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(alphabet.charAt(r.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    @Test
    @TestSecurity(user = "b001")
    @OidcSecurity(claims = {@Claim(key = "sub", value = OWNER), @Claim(key = "email", value = "owner@example.com")})
    void exportHasAttachmentHeaderAndOnlyTheCallersData() {
        UUID me = UUID.fromString(OWNER);
        UUID other = UUID.fromString(BYSTANDER);
        String mine = randomVin();
        String theirs = randomVin();
        registering.register(new RegisterVehicleCommand(me, mine, "Dacia", "Duster", null, 2020, "DIESEL"));
        registering.register(new RegisterVehicleCommand(other, theirs, "Dacia", "Sandero", null, 2018, "PETROL"));
        adding.add(new AddEventCommand(me, mine, "SERVICE", LocalDate.parse("2025-03-01"), 1000, BigDecimal.TEN,
                "RON", "oil change"));
        adding.add(new AddEventCommand(me, mine, "SERVICE", LocalDate.parse("2025-04-01"), 2000, BigDecimal.TEN,
                "RON", null));
        adding.add(new AddEventCommand(other, theirs, "SERVICE", LocalDate.parse("2025-03-01"), 1000,
                BigDecimal.TEN, "RON", "not yours"));
        passports.create(me, mine, null);
        passports.create(other, theirs, null);
        consents.record(me, new ConsentChange(List.of(new ConsentAcceptance(ConsentType.TERMS, "1.0")), null, null,
                ConsentSource.SIGN_UP_FORM));
        consents.record(other, new ConsentChange(List.of(new ConsentAcceptance(ConsentType.TERMS, "1.0")), true, null,
                ConsentSource.SIGN_UP_FORM));

        given().when().get("/me/export")
                .then().statusCode(200)
                .header("Content-Disposition", startsWith("attachment"))
                .header("Content-Disposition", containsString("filename="))
                .contentType("application/json")
                .body("exportedAt", notNullValue())
                .body("profile.id", equalTo(OWNER))
                .body("profile.email", equalTo("owner@example.com"))
                .body("settings.language", notNullValue())
                .body("vehicles", hasSize(1))
                .body("vehicles[0].vin", equalTo(mine))
                .body("events", hasSize(2))
                .body("events.vin", everyItem(equalTo(mine)))
                .body("events.notes", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("not yours")))
                .body("passports", hasSize(1))
                .body("passports[0].vin", equalTo(mine))
                .body("consents", hasSize(1))
                .body("consents[0].type", equalTo("terms"));
    }

    @Test
    @TestSecurity(user = "b003")
    @OidcSecurity(claims = @Claim(key = "sub", value = EMPTY))
    void exportWorksForUserWithNoVehicles() {
        given().when().get("/me/export")
                .then().statusCode(200)
                .body("vehicles", empty())
                .body("events", empty())
                .body("passports", empty())
                .body("consents", empty());
    }

    @Test
    void exportRequiresAuth() {
        given().when().get("/me/export").then().statusCode(401);
    }
}
