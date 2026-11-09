Feature: Ownership claims
  Scenario: Approved claim transfers ownership
    Given a pending claim by me on a vehicle owned by Alice
    When Alice approves my claim
    Then Alice's ownership period is closed
    And I have an open ownership period
    And Alice's past events remain in the vehicle history without her identity

  Scenario: Approving one claim rejects the others
    Given Bob and I each have a pending claim on a vehicle owned by Alice
    When Alice approves my claim
    Then Bob's claim is REJECTED
    And I have an open ownership period

  Scenario: Owner rejects a claim
    Given a pending claim by me on a vehicle owned by Alice
    When Alice rejects the claim
    Then Alice still owns the vehicle

  Scenario: Claimant withdraws
    Given a pending claim by me on a vehicle owned by Alice
    When I withdraw the claim
    Then Alice has no pending claims

  Scenario: Claiming twice does not duplicate
    Given a pending claim by me on a vehicle owned by Alice
    When I register the same VIN
    Then Alice has 1 pending claim

  Scenario: A non-owner cannot decide a claim
    Given a pending claim by Bob on a vehicle owned by Alice
    When I approve the claim
    Then it is rejected with code "vehicle-not-found"

  Scenario: Decided claim cannot be decided again
    Given a claim by me that Alice rejected
    When Alice approves the claim
    Then it is rejected with code "claim-not-pending"

  Scenario: Releasing a vehicle rejects its pending claims
    Given a pending claim by me on a vehicle owned by Alice
    When Alice releases the vehicle
    Then my claim is REJECTED
