Feature: Manual history
  Scenario: Add a service event
    Given I own vehicle V
    When I add a SERVICE event on 2025-03-01 at 120000 km costing 450 RON
    Then the event is saved with evidence USER_CONFIRMED

  Scenario: Reject contradictory mileage
    Given V has an event on 2025-03-01 at 120000 km
    When I add an event on 2025-06-01 at 90000 km
    Then it is rejected with an odometer inconsistency error

  Scenario Outline: Invalid values are rejected
    Given I own vehicle V
    When I add a SERVICE event on <date> at <km> km costing <cost> RON
    Then it is rejected with code "<code>"
    Examples:
      | date       | km   | cost | code          |
      | 2026-01-16 | 1000 | 10   | invalid-event |
      | 2025-03-01 | -1   | 10   | invalid-event |
      | 2025-03-01 | 1000 | -1   | invalid-event |

  Scenario: Equal mileage is consistent
    Given V has an event on 2025-03-01 at 120000 km
    When I add a SERVICE event on 2025-03-02 at 120000 km costing 10 RON
    Then the event is saved with evidence USER_CONFIRMED

  Scenario: An event inserted between neighbours must fit both
    Given V has an event on 2025-01-01 at 100000 km
    And V has an event on 2025-12-01 at 120000 km
    When I add a SERVICE event on 2025-06-01 at 130000 km costing 10 RON
    Then it is rejected with code "odometer-inconsistent"

  Scenario: Non-owner cannot add
    Given V is owned by another user
    When I add a SERVICE event on 2025-03-01 at 1000 km costing 10 RON
    Then it is rejected with code "vehicle-not-found"
