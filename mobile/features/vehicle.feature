Feature: Vehicle
  Scenario: A car that left the account
    Given a vehicle is open
    When the API answers 404 "vehicle-not-found"
    Then I return to the garage and am told the car is no longer there

  Scenario: A newly registered car opens
    When I register a VIN and the API answers 201
    Then the new vehicle is open

  Scenario: A car I already own is one tap away
    When I register a VIN and the API answers 409 "already-owner"
    Then I can open that vehicle from the message

  Scenario: Saving sends only what changed
    Given I am editing a vehicle
    When I change the model and save
    Then the request contains only the model

  Scenario: Nothing to save
    Given I am editing a vehicle
    Then Save is disabled

  Scenario: Giving up ownership warns first
    When I choose Give up ownership
    Then I am warned that access ends, unconfirmed scans are cancelled and passports stay live
    And no request is sent until I confirm

  Scenario: Pending claims are announced
    Given a vehicle has a pending claim
    When I open it
    Then I see the claims banner

  Scenario: Approving moves the car away
    Given a vehicle has a pending claim
    When I approve it and confirm
    Then I return to the garage and the car is gone

  Scenario: A claim already decided
    When I reject a claim and the API answers 409 "claim-not-pending"
    Then I am told "That claim was already decided."
    And the claim list refreshes

  Scenario: The claimant stays anonymous
    Given a vehicle has a pending claim
    Then only its filing date is shown

  Scenario: The stage never blocks the screen
    Given the 3D stage has not loaded
    When I open a vehicle
    Then I see its name and history

  Scenario: Colour is remembered
    When I choose "Rosso" and reopen the vehicle
    Then "Rosso" is selected
