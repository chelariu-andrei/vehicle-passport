Feature: Plate and look
  Scenario: A new car has no plate and no look
    When I register vehicle "WVWZZZ1JZXW000001" Volkswagen Golf 2018 diesel
    Then my vehicle has no plate and no look

  Scenario: Saving a look and a plate
    Given I own vehicle "WVWZZZ1JZXW000001"
    When I save the look SUV BLUE MATTE AERO BLACK DARK with a black roof and plate "B 123 ABC"
    Then my vehicle has plate "B 123 ABC" and body type "SUV" and colour "BLUE"

  Scenario: The look is replaced as a whole
    Given my vehicle has the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When I save only the colour "RED"
    Then my vehicle's look is exactly colour "RED"

  Scenario: Clearing the plate
    Given my vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When I clear the plate
    Then my vehicle has no plate
    And my vehicle has body type "SUV" and colour "BLUE"

  Scenario: Editing other details keeps the plate and look
    Given my vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When I change its model to "Passat"
    Then my vehicle has plate "B 123 ABC" and body type "SUV" and colour "BLUE"

  Scenario: Only the owner sets the look
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I save only the colour "RED"
    Then it is rejected with code "vehicle-not-found"

  Scenario: A plate outside the contract is refused
    Given I own vehicle "WVWZZZ1JZXW000001"
    When I save the plate "b 123"
    Then it is rejected with code "invalid-vehicle"

  Scenario: Approving a claim clears the plate and keeps the look
    Given a pending claim by me on a vehicle owned by Alice
    And Alice's vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When Alice approves my claim
    Then my vehicle has no plate
    And my vehicle has body type "SUV" and colour "BLUE"

  Scenario: Releasing clears the plate for the next owner
    Given Alice's vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    And Alice released it
    When I register the same VIN
    Then my vehicle has no plate
    And my vehicle has body type "SUV" and colour "BLUE"

  Scenario: Rejecting a claim keeps the plate
    Given a pending claim by me on a vehicle owned by Alice
    And Alice's vehicle has plate "B 123 ABC"
    When Alice rejects the claim
    Then Alice's vehicle still has plate "B 123 ABC"
