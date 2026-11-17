package com.vehiclepassport.server.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(user = "contract")
class ContractConformanceIT {

    private static final Set<String> METHODS =
            Set.of("get", "put", "post", "delete", "patch", "head", "options");

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

    /**
     * The two route tests above compare the contract with the served document, which is the contract itself
     * (annotation scanning is off), so they cannot notice a missing resource. This one calls every operation of the
     * given tags: a route that exists answers with a problem body (no vehicle is owned here), while a missing route
     * answers a bare 404 or 405.
     */
    @Test
    void everyFuelOperationIsRouted() throws IOException {
        JsonNode doc = new YAMLMapper().readTree(contractFile());
        List<String> checked = new ArrayList<>();
        List<String> unrouted = new ArrayList<>();
        doc.path("paths").fields().forEachRemaining(p -> p.getValue().fields().forEachRemaining(op -> {
            String method = op.getKey().toLowerCase(Locale.ROOT);
            if (!METHODS.contains(method) || !tagged(op.getValue(), "fuel")) {
                return;
            }
            String path = p.getKey().replace("{vin}", "WVWZZZ1JZXW999999")
                    .replace("{entryId}", UUID.randomUUID().toString());
            Response r = RestAssured.given().contentType("application/json")
                    .body("{\"date\":\"2025-10-01\",\"odometerKm\":1000,\"fuelType\":\"DIESEL\","
                            + "\"quantity\":40,\"total\":300,\"currency\":\"RON\"}")
                    .request(method.toUpperCase(Locale.ROOT), path);
            String route = method.toUpperCase(Locale.ROOT) + " " + p.getKey();
            checked.add(route);
            String type = r.getContentType() == null ? "" : r.getContentType();
            if (!type.startsWith("application/problem+json") && (r.statusCode() == 404 || r.statusCode() == 405)) {
                unrouted.add(route + " -> " + r.statusCode());
            }
        }));
        assertEquals(5, checked.size(), "fuel operations in the contract: " + checked);
        assertTrue(unrouted.isEmpty(), "Fuel operations without a route: " + unrouted);
    }

    private static boolean tagged(JsonNode operation, String tag) {
        for (JsonNode t : operation.path("tags")) {
            if (tag.equals(t.asText())) {
                return true;
            }
        }
        return false;
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
