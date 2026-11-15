package com.vehiclepassport.server.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.RestAssured;
import java.io.File;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(user = "contract")
class ContractConformanceIT {

    private static final Set<String> METHODS =
            Set.of("get", "put", "post", "delete", "patch", "head", "options");

    // TEMPORARY (account backend): contract operations whose server side lands in Tasks 4-10.
    // Task 11 deletes this set and its use in everyContractRouteIsImplemented.
    private static final Set<String> EXPECTED_UNIMPLEMENTED = Set.of(
            "GET /public/legal/documents",
            "GET /public/legal/documents/{type}",
            "GET /me",
            "PATCH /me",
            "GET /me/settings",
            "PUT /me/settings",
            "GET /me/consents",
            "POST /me/consents",
            "GET /me/consents/history",
            "POST /me/deletion",
            "DELETE /me/deletion",
            "GET /me/export",
            "POST /support/reports");

    @Test
    void everyImplementedRouteIsInTheContract() throws IOException {
        Set<String> contract = routes(new YAMLMapper().readTree(contractFile()));
        String json = RestAssured.given().when().get("/q/openapi?format=json")
                .then().statusCode(200).extract().asString();
        Set<String> implemented = routes(new ObjectMapper().readTree(json));

        Set<String> undeclared = new TreeSet<>(implemented);
        undeclared.removeAll(contract);
        assertTrue(undeclared.isEmpty(),
                "Routes implemented but missing from contracts/openapi.yaml: " + undeclared);
    }

    @Test
    void everyContractRouteIsImplemented() throws IOException {
        Set<String> contract = routes(new YAMLMapper().readTree(contractFile()));
        String json = RestAssured.given().when().get("/q/openapi?format=json")
                .then().statusCode(200).extract().asString();
        Set<String> implemented = routes(new ObjectMapper().readTree(json));

        Set<String> missing = new TreeSet<>(contract);
        missing.removeAll(implemented);
        missing.removeAll(EXPECTED_UNIMPLEMENTED);
        assertTrue(missing.isEmpty(),
                "Routes in contracts/openapi.yaml but not implemented: " + missing);
    }

    @Test
    void publicRoutesAreOnlyThePassportAndLegalOnes() throws IOException {
        Set<String> contract = routes(new YAMLMapper().readTree(contractFile()));
        Set<String> publicPaths = new TreeSet<>();
        for (String r : contract) {
            String path = r.substring(r.indexOf(' ') + 1);
            if (path.startsWith("/public/")) {
                publicPaths.add(path);
            }
        }
        assertEquals(Set.of("/public/passports/{token}", "/public/passports/{token}/pdf",
                "/public/legal/documents", "/public/legal/documents/{type}"), publicPaths);
    }

    private static File contractFile() {
        File f = new File("../contracts/openapi.yaml");
        return f.exists() ? f : new File("contracts/openapi.yaml");
    }

    private static Set<String> routes(JsonNode doc) {
        Set<String> out = new TreeSet<>();
        doc.path("paths").fields().forEachRemaining(p -> {
            String path = p.getKey();
            if (path.equals("/public/test-ping") || path.startsWith("/test/")) {
                return;
            }
            p.getValue().fieldNames().forEachRemaining(m -> {
                if (METHODS.contains(m.toLowerCase(Locale.ROOT))) {
                    out.add(m.toUpperCase(Locale.ROOT) + " " + path);
                }
            });
        });
        return out;
    }
}
