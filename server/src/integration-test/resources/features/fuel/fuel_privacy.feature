Feature: Fuel privacy

  Background:
    Given today is 2026-11-17

  Scenario: Another owner's car is not found
    Given V is owned by another user
    When I request the fuel stats of V
    Then it is rejected with code "vehicle-not-found"
    When I add this fill-up
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
    Then it is rejected with code "vehicle-not-found"

  Scenario: After a transfer the new owner sees none of my fill-ups
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
    And ownership of V moved to Alice
    Then Alice lists no fill-ups on V
    And Alice's fuel stats of V count no fill-ups
    When I request the fuel stats of V
    Then it is rejected with code "vehicle-not-found"

  Scenario: Deleting my account purges my fill-ups
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
    When my account is purged
    Then none of my fill-ups is left

  Scenario: My data export contains my fill-ups
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full | station       |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  | Petrom Unirii |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |               |
    When I export my data
    Then the export lists 2 fill-ups on V
    And the exported fill-up of 2026-10-20 has consumption 7.00

  Scenario: A passport created after fill-ups carries none of them
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full | station       | note             |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  | Petrom Unirii | my private note  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |               |                  |
    When I create a passport for V after my fill-ups
    Then the passport snapshot holds none of my fill-ups
