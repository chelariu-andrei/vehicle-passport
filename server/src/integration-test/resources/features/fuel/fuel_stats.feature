Feature: Fuel statistics

  Background:
    Given today is 2026-11-17
    And I own vehicle V with fuel DIESEL

  Scenario: Cost per month with the distance driven
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-09-25 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-05 | 10300 | 21.0     | 157.50 | no   |
      | 2026-10-20 | 10600 | 21.0     | 157.50 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then month 2026-09 cost 300.00 over 1 fill-up with no distance
    And month 2026-10 cost 315.00 over 2 fill-ups and 600 km
    And month 2026-11 cost 315.00 over 1 fill-up and 600 km
    And the total cost is 930.00

  Scenario: Cost per km leaves out the first fill-up
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then the cost per km is 0.5250

  Scenario: The month estimate needs three fill-ups in the last 60 days
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-08-01 | 9000  | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then the month estimate for 2026-11 is not available with 315.00 spent so far

  Scenario: The month estimate projects the last 60 days onto this month
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-09-25 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then the month estimate for 2026-11 is 465.00 with 315.00 spent so far

  Scenario: Premium and standard are not compared with only two premium tanks
    Given V has three consecutive STANDARD full tanks at 7.0 L/100 km
    And V has two consecutive PREMIUM full tanks at 6.5 L/100 km
    When I request the fuel stats of V
    Then there is no DIESEL grade comparison

  Scenario: Premium and standard are compared with three tanks of each
    Given V has three consecutive STANDARD full tanks at 7.0 L/100 km
    And V has three consecutive PREMIUM full tanks at 6.5 L/100 km
    When I request the fuel stats of V
    Then the DIESEL grade comparison shows STANDARD at 7.00 over 3 tanks and PREMIUM at 6.50 over 3 tanks

  Scenario: Fill-ups in another currency are counted but left out
    Given V has these fill-ups
      | date       | km    | quantity | total  | full | currency |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  | RON      |
      | 2026-10-10 | 10300 | 40.0     | 60.00  | yes  | EUR      |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  | RON      |
      | 2026-11-05 | 11200 | 42.0     | 315.00 | yes  | RON      |
    When I request the fuel stats of V
    Then the stats are in RON with 3 fill-ups and 1 ignored
    And the total cost is 930.00
