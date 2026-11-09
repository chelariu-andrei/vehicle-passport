Feature: Garage
  Scenario: A VIN with an active owner files a claim
    When I register a VIN and the API answers 202
    Then no vehicle is added to my garage
    And I see a pending claim row for that VIN

  Scenario: An approved claim resolves itself
    Given I have a pending claim row for a VIN
    When my garage list contains that VIN
    Then the claim row is gone and the vehicle is shown

  Scenario: The odometer comes from the latest entry
    Given a car with entries at 100 km, confirmed and 200 km, documented
    When I open the garage
    Then its card shows "200 km" with evidence "documented"

  Scenario: A car with no history
    Given a car with no entries
    Then its card shows "No entries yet"

  Scenario: Empty garage
    Given I have no cars
    Then I see "Add your first car"

  Scenario: The garage never runs a live 3D stage
    Given I have two cars
    When I open the garage
    Then no WebView is mounted

  Scenario: Filing the same claim twice shows one row
    Given I have a pending claim row for a VIN
    When I register that VIN and the API answers 202 with the same claim id
    Then I see one pending claim row

  Scenario Outline: Withdrawing removes the row
    Given I have a pending claim row for a VIN
    When I withdraw it and the API answers <answer>
    Then the row is gone

    Examples:
      | answer                  |
      | 204                     |
      | 409 "claim-not-pending" |
      | 404 "claim-not-found"   |

  Scenario: Already mine
    When I register a VIN and the API answers 409 "already-owner"
    Then I am told "This car is already in your garage."

  Scenario: Offline garage
    Given my garage has loaded
    When the connection drops
    Then I see the offline banner and my car is still shown
