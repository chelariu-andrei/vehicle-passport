Feature: Fuel entries

  Background:
    Given today is 2026-11-17

  Scenario: Adding a fill-up stores the derived unit price
    Given I own vehicle V with fuel DIESEL
    When I add this fill-up
      | date       | km    | quantity | total  | full |
      | 2026-11-10 | 10000 | 30.0     | 245.00 | yes  |
    Then the fill-up is saved with unit price 8.1667 per L

  Scenario: An odometer below the previous fill-up is refused
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
    When I add this fill-up
      | date       | km   | quantity | total  | full |
      | 2026-10-20 | 9900 | 42.0     | 315.00 | yes  |
    Then it is rejected with code "odometer-inconsistent"

  Scenario: An odometer below a recorded service is refused
    Given I own vehicle V with fuel DIESEL
    And V has a SERVICE at 2026-09-01 with 12000 km
    When I add this fill-up
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 11000 | 40.0     | 300.00 | yes  |
    Then it is rejected with code "odometer-inconsistent"

  Scenario: Electric charging on a diesel car is refused
    Given I own vehicle V with fuel DIESEL
    When I add this fill-up
      | date       | km    | quantity | total | full | type     |
      | 2026-10-01 | 10000 | 40.0     | 80.00 | yes  | ELECTRIC |
    Then it is rejected with code "invalid-fuel-entry"

  Scenario: A grade on electric charging is refused
    Given I own vehicle V with fuel ELECTRIC
    When I add this fill-up
      | date       | km    | quantity | total | full | type     | grade   |
      | 2026-10-01 | 10000 | 40.0     | 80.00 | yes  | ELECTRIC | PREMIUM |
    Then it is rejected with code "invalid-fuel-entry"

  Scenario: A hybrid car takes petrol and electricity
    Given I own vehicle V with fuel HYBRID
    When I add these fill-ups
      | date       | km    | quantity | total  | full | type     | charge |
      | 2026-10-01 | 10000 | 35.0     | 260.00 | yes  | PETROL   |        |
      | 2026-10-02 | 10050 | 20.0     | 30.00  | yes  | ELECTRIC | HOME   |
    Then V lists 2 fill-ups
    And the fill-up of 2026-10-01 is measured in L
    And the fill-up of 2026-10-02 is measured in KWH

  Scenario: Editing a fill-up checks the odometer again
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I change the km of the fill-up of 2026-10-20 to 11500
    Then it is rejected with code "odometer-inconsistent"
    When I change the km of the fill-up of 2026-10-20 to 10700
    Then the fill-up of 2026-10-20 is at 10700 km

  Scenario: Deleting a fill-up removes it from the stats
    Given I own vehicle V with fuel DIESEL
    And V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I delete the fill-up of 2026-10-20
    And I request the fuel stats of V
    Then the stats count 2 fill-ups
    And the DIESEL average consumption is 3.50

  Scenario: Fill-ups are listed newest first, page by page
    Given I own vehicle V with fuel DIESEL
    And V has 5 fill-ups
    When I list the fill-ups of V 2 at a time
    Then I see all 5 fill-ups exactly once, newest first

  Scenario: A malformed cursor is refused
    Given I own vehicle V with fuel DIESEL
    When I list the fill-ups of V with the cursor "not-a-cursor"
    Then it is rejected with code "validation-failed"
