Feature: Passport
  Scenario: Snapshot is frozen
    Given I created a passport for V
    When I add a new event to V
    Then the passport content and hash are unchanged

  Scenario: No owner data leaks
    Given I created a passport for V
    When anyone opens the public link
    Then the response contains no owner or creator identifiers

  Scenario: Revoked link
    Given a public link I revoked
    When anyone opens it
    Then the response is 404

  Scenario: Expired link
    Given a link with expiry in the past
    Then it behaves exactly like a revoked link

  Scenario: Hash verifies
    Given I created a passport for V
    When anyone opens the public link
    Then recomputing the hash of the served snapshot equals the published hash

  Scenario: Snapshot contains the whole history at creation
    Given V has a USER_CONFIRMED event and a DOCUMENTED event with parts
    When I create a passport for V
    Then the snapshot lists both with evidence, details and the document-present flag

  Scenario: Deleted events are not in new passports, and old passports keep them
    Given a passport P1 created while event E existed
    When I delete E and create a passport P2
    Then P1 still contains E and P2 does not

  Scenario: Unknown, revoked and expired links are indistinguishable
    Given one revoked link and one expired link
    When anyone opens them and an unknown link
    Then all three fail identically

  Scenario: Revoke is idempotent
    Given a public link I revoked
    When I revoke it again
    Then no error occurs

  Scenario: Expiry in the past is refused
    Given I own vehicle V for passports
    When I create a passport for V expiring yesterday
    Then it is rejected with code "expiry-in-past"

  Scenario: Only the active owner creates passports
    Given V is owned by another user for passports
    When I create a passport for V
    Then it is rejected with code "vehicle-not-found"

  Scenario: The former owner's passport stays live and revocable after a transfer
    Given I created a passport for V, then ownership moved to Alice
    When anyone opens the public link
    Then the snapshot is served
    When I revoke it
    Then the link is gone

  Scenario: The new owner cannot revoke the previous owner's passport
    Given Alice created a passport for V, then ownership moved to me
    When I revoke it
    Then it is rejected with code "passport-not-found"

  Scenario: Owner can re-fetch the link and PDF later
    Given I created a passport for V
    When I list my passports
    Then I see the same public URL and hash
    And my PDF equals the PDF stored at creation

  Scenario: Each passport has its own link
    Given I own vehicle V for passports
    When I create two passports for V
    Then their public URLs differ
