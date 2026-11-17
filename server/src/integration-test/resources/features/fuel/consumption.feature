Feature: Fuel consumption

  Background:
    Given today is 2026-11-17
    And I own vehicle V with fuel DIESEL

  Scenario: Consumption is computed between two full tanks
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then the DIESEL average consumption is 7.00
    And the fill-up of 2026-10-20 has consumption 7.00

  Scenario: A partial fill-up counts in the segment but does not close it
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-10 | 10300 | 20.0     | 150.00 | no   |
      | 2026-10-20 | 10600 | 22.0     | 165.00 | yes  |
    When I request the fuel stats of V
    Then the DIESEL average consumption is 7.00
    And the fill-up of 2026-10-10 has no consumption

  Scenario: A missed fill-up excludes the segment
    Given V has these fill-ups
      | date       | km    | quantity | total  | full | missed |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  | no     |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  | yes    |
    When I request the fuel stats of V
    Then the DIESEL average consumption is not available

  Scenario: A sudden increase raises an alert
    Given V has four consecutive full tanks at 6.8 L/100 km
    And V then has a full tank at 8.4 L/100 km
    When I request the fuel stats of V
    Then the DIESEL alert shows 8.40 against a baseline of 6.80

  Scenario: Three baseline tanks are needed before alerting
    Given V has two consecutive full tanks at 6.8 L/100 km
    And V then has a full tank at 9.5 L/100 km
    When I request the fuel stats of V
    Then there is no DIESEL alert
