package com.vehiclepassport.server.passport.steps;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportPdfUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPassportQrUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPublicPassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.ListMyPassportsUseCase;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.passport.application.port.in.PublicPassportView;
import com.vehiclepassport.server.passport.application.port.in.RevokePassportLinkUseCase;
import com.vehiclepassport.server.passport.domain.exception.PassportNotFoundException;
import com.vehiclepassport.server.passport.domain.model.SnapshotHasher;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.FakePassportFileStorage;
import com.vehiclepassport.server.testsupport.fake.TestClock;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class PassportSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String URL_PREFIX = "/public/passports/";
    private static final String MARKER = "event-E-marker";

    private static final String OWNED = "passport.owned";
    private static final String CREATED = "passport.created";
    private static final String FIRST = "passport.first";
    private static final String SECOND = "passport.second";
    private static final String PUBLIC = "passport.public";
    private static final String BEFORE = "passport.before";
    private static final String EVENT_E = "passport.eventE";
    private static final String LISTED = "passport.listed";
    private static final String REVOKED = "passport.revoked";
    private static final String EXPIRED = "passport.expired";
    private static final String OPENED = "passport.opened";

    @Inject
    World world;

    @Inject
    TestClock clock;

    @Inject
    CreatePassportUseCase create;

    @Inject
    RevokePassportLinkUseCase revoke;

    @Inject
    ListMyPassportsUseCase list;

    @Inject
    GetPublicPassportUseCase publicPassport;

    @Inject
    GetPassportPdfUseCase pdf;

    @Inject
    GetPassportQrUseCase qr;

    @Inject
    AddEventUseCase addEvent;

    @Inject
    DeleteEventUseCase deleteEvent;

    @Inject
    SaveConfirmedEventUseCase saveConfirmed;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ReleaseVehicleUseCase release;

    @Inject
    FakePassportFileStorage storage;

    // ---- Given -------------------------------------------------------------------------------------------

    @Given("I own vehicle V for passports")
    public void iOwnVehicleVForPassports() {
        ownAsMe();
    }

    @Given("V is owned by another user for passports")
    public void vIsOwnedByAnotherUser() {
        registerAs(world.user("Alice"));
    }

    @Given("I created a passport for V")
    public void iCreatedAPassportForV() {
        ownAsMe();
        add(world.me(), "2025-03-01", 120000, "first service");
        createAs(world.me(), CREATED, null);
        world.put(BEFORE, publicPassport.get(tokenOf(created())));
    }

    @Given("a public link I revoked")
    public void aPublicLinkIRevoked() {
        ownAsMe();
        add(world.me(), "2025-03-01", 120000, "first service");
        createAs(world.me(), CREATED, null);
        revoke.revoke(world.me(), created().id());
    }

    @Given("a link with expiry in the past")
    public void aLinkWithExpiryInThePast() {
        ownAsMe();
        add(world.me(), "2025-03-01", 120000, "first service");
        world.put(EXPIRED, expiredLink());
    }

    @Given("one revoked link and one expired link")
    public void oneRevokedLinkAndOneExpiredLink() {
        ownAsMe();
        add(world.me(), "2025-03-01", 120000, "first service");
        PassportView toRevoke = create.create(world.me(), VIN, null);
        revoke.revoke(world.me(), toRevoke.id());
        world.put(REVOKED, toRevoke);
        world.put(EXPIRED, expiredLink());
    }

    @Given("V has a USER_CONFIRMED event and a DOCUMENTED event with parts")
    public void vHasBothKindsOfEvent() {
        ownAsMe();
        add(world.me(), "2025-01-10", 100000, "plain");
        DetailsView details = new DetailsView("Garage Sud",
                List.of(new PartView("Oil filter", new BigDecimal("1.50"), new BigDecimal("30"))),
                new BigDecimal("100"));
        saveConfirmed.save(new SaveConfirmedEventCommand(world.me(), VIN, "SERVICE", LocalDate.parse("2025-03-01"),
                120000, new BigDecimal("450.00"), "RON", "from receipt", details, "docs/receipt.pdf"));
    }

    @Given("a passport P1 created while event E existed")
    public void aPassportP1CreatedWhileEventEExisted() {
        ownAsMe();
        EventView e = add(world.me(), "2025-03-01", 120000, MARKER);
        world.put(EVENT_E, e.id());
        createAs(world.me(), FIRST, null);
    }

    @Given("I created a passport for V, then ownership moved to Alice")
    public void iCreatedThenOwnershipMovedToAlice() {
        ownAsMe();
        add(world.me(), "2025-03-01", 120000, "first service");
        createAs(world.me(), CREATED, null);
        release.release(VIN, world.me());
        registerAs(world.user("Alice"));
    }

    @Given("Alice created a passport for V, then ownership moved to me")
    public void aliceCreatedThenOwnershipMovedToMe() {
        UUID alice = world.user("Alice");
        registerAs(alice);
        add(alice, "2025-03-01", 120000, "first service");
        createAs(alice, CREATED, null);
        release.release(VIN, alice);
        registerAs(world.me());
    }

    // ---- When --------------------------------------------------------------------------------------------

    @When("I create a passport for V")
    public void iCreateAPassportForV() {
        world.attempt(() -> createAs(world.me(), CREATED, null));
    }

    @When("I create a passport for V expiring yesterday")
    public void iCreateAPassportExpiringYesterday() {
        Instant yesterday = clock.instant().minus(Duration.ofDays(1));
        world.attempt(() -> createAs(world.me(), CREATED, yesterday));
    }

    @When("I create two passports for V")
    public void iCreateTwoPassportsForV() {
        createAs(world.me(), FIRST, null);
        createAs(world.me(), SECOND, null);
    }

    @When("I add a new event to V")
    public void iAddANewEventToV() {
        add(world.me(), "2025-06-01", 130000, "added after the passport");
    }

    @When("anyone opens the public link")
    public void anyoneOpensThePublicLink() {
        String token = tokenOf(created());
        world.attempt(() -> world.put(PUBLIC, publicPassport.get(token)));
    }

    @When("anyone opens it")
    public void anyoneOpensIt() {
        anyoneOpensThePublicLink();
    }

    @When("I delete E and create a passport P2")
    public void iDeleteEAndCreateP2() {
        deleteEvent.delete(world.me(), VIN, world.get(EVENT_E));
        createAs(world.me(), SECOND, null);
    }

    @When("anyone opens them and an unknown link")
    public void anyoneOpensThemAndAnUnknownLink() {
        List<RuntimeException> errors = new java.util.ArrayList<>();
        for (String token : List.of(tokenOf(world.get(REVOKED)), tokenOf(world.get(EXPIRED)), "no-such-token")) {
            errors.add(catching(() -> publicPassport.get(token)));
            errors.add(catching(() -> pdf.publicPdf(token)));
        }
        world.put(OPENED, errors);
    }

    @When("I revoke it again")
    public void iRevokeItAgain() {
        world.attempt(() -> revoke.revoke(world.me(), created().id()));
    }

    @When("I revoke it")
    public void iRevokeIt() {
        world.attempt(() -> revoke.revoke(world.me(), created().id()));
    }

    @When("I list my passports")
    public void iListMyPassports() {
        world.put(LISTED, list.list(world.me()));
    }

    // ---- Then --------------------------------------------------------------------------------------------

    @Then("the passport content and hash are unchanged")
    public void theContentAndHashAreUnchanged() {
        PublicPassportView before = world.get(BEFORE);
        PublicPassportView after = publicPassport.get(tokenOf(created()));
        assertEquals(before.snapshotJson(), after.snapshotJson());
        assertEquals(before.hash(), after.hash());
        assertEquals(before.hash(), created().hash());
        assertFalse(after.snapshotJson().contains("added after the passport"));
        assertEquals(created().hash(), list.list(world.me()).get(0).hash());
    }

    @Then("the response contains no owner or creator identifiers")
    public void noOwnerOrCreatorIdentifiers() {
        assertNoError();
        PublicPassportView view = world.get(PUBLIC);
        assertNotNull(view);
        String all = view.snapshotJson() + view.hash();
        for (String who : List.of("me", "Alice")) {
            assertFalse(all.contains(world.user(who).toString()), "leaks the id of " + who);
        }
        String lower = all.toLowerCase(java.util.Locale.ROOT);
        for (String word : List.of("owner", "creator", "createdby", "period", "userid")) {
            assertFalse(lower.contains(word), "snapshot mentions " + word);
        }
    }

    @Then("the response is 404")
    public void theResponseIs404() {
        RuntimeException error = world.lastError();
        assertNotNull(error, "expected a failure");
        DomainException d = assertInstanceOf(DomainException.class, error);
        assertEquals(ErrorKind.NOT_FOUND, d.kind());
        assertEquals("passport-not-found", d.code());
    }

    @Then("it behaves exactly like a revoked link")
    public void itBehavesLikeARevokedLink() {
        PassportView revoked = create.create(world.me(), VIN, null);
        revoke.revoke(world.me(), revoked.id());
        RuntimeException expired = catching(() -> publicPassport.get(tokenOf(world.get(EXPIRED))));
        RuntimeException gone = catching(() -> publicPassport.get(tokenOf(revoked)));
        assertSame(gone, expired);
        assertEquals(ErrorKind.NOT_FOUND, ((DomainException) expired).kind());
        PassportView expiredView = list.list(world.me()).stream()
                .filter(p -> p.publicUrl().equals(((PassportView) world.get(EXPIRED)).publicUrl())).findFirst()
                .orElseThrow();
        assertEquals("EXPIRED", expiredView.status());
    }

    @Then("recomputing the hash of the served snapshot equals the published hash")
    public void recomputingTheHashEqualsThePublishedHash() {
        assertNoError();
        PublicPassportView view = world.get(PUBLIC);
        assertEquals(view.hash(), SnapshotHasher.sha256Hex(view.snapshotJson()));
        assertEquals(created().hash(), view.hash());
    }

    @Then("the snapshot lists both with evidence, details and the document-present flag")
    public void theSnapshotListsBoth() {
        assertNoError();
        String json = publicPassport.get(tokenOf(created())).snapshotJson();
        assertEquals(2, count(json, "\"evidence\":"));
        assertTrue(json.contains("\"evidence\":\"USER_CONFIRMED\""), json);
        assertTrue(json.contains("\"evidence\":\"DOCUMENTED\""), json);
        assertTrue(json.contains("\"documentPresent\":true"), json);
        assertTrue(json.contains("\"documentPresent\":false"), json);
        assertTrue(json.contains("\"serviceName\":\"Garage Sud\""), json);
        assertTrue(json.contains("\"name\":\"Oil filter\""), json);
        assertTrue(json.contains("\"qty\":1.5"), json);
        assertTrue(json.contains("\"price\":\"30.00\""), json);
        assertTrue(json.contains("\"labor\":\"100.00\""), json);
    }

    @Then("P1 still contains E and P2 does not")
    public void p1StillContainsEAndP2DoesNot() {
        assertTrue(publicPassport.get(tokenOf(world.get(FIRST))).snapshotJson().contains(MARKER));
        assertFalse(publicPassport.get(tokenOf(world.get(SECOND))).snapshotJson().contains(MARKER));
    }

    @Then("all three fail identically")
    public void allThreeFailIdentically() {
        List<RuntimeException> errors = world.get(OPENED);
        assertEquals(6, errors.size());
        for (RuntimeException e : errors) {
            assertNotNull(e, "every unavailable link must be refused");
            assertSame(errors.get(0), e);
        }
        assertEquals(ErrorKind.NOT_FOUND, ((DomainException) errors.get(0)).kind());
    }

    @Then("no error occurs")
    public void noErrorOccurs() {
        assertNoError();
        List<PassportView> mine = list.list(world.me());
        assertEquals(1, mine.size());
        assertEquals("REVOKED", mine.get(0).status());
    }

    @Then("the snapshot is served")
    public void theSnapshotIsServed() {
        assertNoError();
        PublicPassportView view = world.get(PUBLIC);
        assertNotNull(view);
        assertEquals(created().hash(), view.hash());
    }

    @Then("the link is gone")
    public void theLinkIsGone() {
        assertNoError();
        String token = tokenOf(created());
        DomainException d = assertThrows(PassportNotFoundException.class, () -> publicPassport.get(token));
        assertEquals("passport-not-found", d.code());
    }

    @Then("I see the same public URL and hash")
    public void iSeeTheSameUrlAndHash() {
        List<PassportView> listed = world.get(LISTED);
        assertEquals(1, listed.size());
        assertEquals(created().id(), listed.get(0).id());
        assertEquals(created().publicUrl(), listed.get(0).publicUrl());
        assertEquals(created().hash(), listed.get(0).hash());
        assertEquals("ACTIVE", listed.get(0).status());
        assertNull(listed.get(0).expiresAt());
        byte[] qrPng = qr.ownerQr(world.me(), created().id());
        assertEquals("QR|" + created().publicUrl(), new String(qrPng, StandardCharsets.UTF_8));
    }

    @Then("my PDF equals the PDF stored at creation")
    public void myPdfEqualsTheStoredPdf() {
        PassportView p = created();
        byte[] stored = storage.read("passports/" + p.id() + ".pdf");
        byte[] mine = pdf.ownerPdf(world.me(), p.id());
        assertArrayEquals(stored, mine);
        String text = new String(mine, StandardCharsets.UTF_8);
        assertTrue(text.contains(p.hash()), text);
        assertTrue(text.contains(p.publicUrl()), text);
        assertArrayEquals(mine, pdf.publicPdf(tokenOf(p)));
    }

    @Then("their public URLs differ")
    public void theirPublicUrlsDiffer() {
        PassportView a = world.get(FIRST);
        PassportView b = world.get(SECOND);
        assertNotEquals(a.publicUrl(), b.publicUrl());
        assertNotEquals(a.id(), b.id());
        assertTrue(a.publicUrl().startsWith("http"));
        assertTrue(a.publicUrl().contains(URL_PREFIX));
    }

    // ---- helpers -----------------------------------------------------------------------------------------

    private PassportView created() {
        return world.get(CREATED);
    }

    private PassportView expiredLink() {
        PassportView view = create.create(world.me(), VIN, clock.instant().plus(Duration.ofHours(1)));
        clock.advance(Duration.ofHours(2));
        return view;
    }

    private void createAs(UUID user, String key, Instant expiresAt) {
        world.put(key, create.create(user, VIN, expiresAt));
    }

    private static String tokenOf(PassportView view) {
        String url = view.publicUrl();
        return url.substring(url.indexOf(URL_PREFIX) + URL_PREFIX.length());
    }

    private static RuntimeException catching(Runnable action) {
        try {
            action.run();
            return null;
        } catch (RuntimeException e) {
            return e;
        }
    }

    /** Same exception type, kind, code and detail text. */
    private static void assertSame(RuntimeException expected, RuntimeException actual) {
        assertNotNull(expected, "expected a failure");
        assertNotNull(actual, "expected a failure");
        assertEquals(expected.getClass(), actual.getClass());
        assertEquals(((DomainException) expected).kind(), ((DomainException) actual).kind());
        assertEquals(((DomainException) expected).code(), ((DomainException) actual).code());
        assertEquals(expected.getMessage(), actual.getMessage());
    }

    private static int count(String text, String needle) {
        int n = 0;
        for (int i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
            n++;
        }
        return n;
    }

    private void ownAsMe() {
        if (world.get(OWNED) == null) {
            registerAs(world.me());
            world.put(OWNED, true);
        }
    }

    private void registerAs(UUID user) {
        register.register(new RegisterVehicleCommand(user, VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private EventView add(UUID user, String date, int km, String notes) {
        return addEvent.add(new AddEventCommand(
                user, VIN, "SERVICE", LocalDate.parse(date), km, BigDecimal.TEN, "RON", notes));
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
    }
}
