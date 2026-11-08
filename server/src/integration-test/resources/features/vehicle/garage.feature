Feature: Garage
  Scenario: Register a new vehicle
    Given I am an authenticated user
    When I register vehicle "WVWZZZ1JZXW000001" Volkswagen Golf 2018 diesel
    Then the vehicle exists in my garage
    And I have an open ownership period for it

  Scenario: VIN already has an active owner
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I register the same VIN
    Then no ownership is created

  Scenario: Registering a VIN I already own is rejected
    Given I own vehicle "WVWZZZ1JZXW000001"
    When I register the same VIN
    Then it is rejected with code "already-owner"

  Scenario Outline: Invalid VIN is rejected
    When I register vehicle "<vin>" Volkswagen Golf 2018 diesel
    Then it is rejected with code "invalid-vin"
    Examples:
      | vin                |
      | WVWZZZ1JZXW00000   |
      | WVWZZZ1JZXW0000011 |
      | IVWZZZ1JZXW000001  |
      | OVWZZZ1JZXW000001  |
      | QVWZZZ1JZXW000001  |

  Scenario: VIN case is normalised
    When I register vehicle "wvwzzz1jzxw000001" Volkswagen Golf 2018 diesel
    Then the vehicle "WVWZZZ1JZXW000001" exists in my garage

  Scenario: A VIN with history and no owner can be registered by anyone
    Given Alice owned vehicle "WVWZZZ1JZXW000001" and released it
    When I register the same VIN
    Then I have an open ownership period for it

  Scenario: A foreign vehicle looks non-existent
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I fetch that vehicle
    Then it is rejected with code "vehicle-not-found"

  Scenario: Only the active owner corrects vehicle data
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I change its model to "Passat"
    Then it is rejected with code "vehicle-not-found"
