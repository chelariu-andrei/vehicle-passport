Feature: Full timeline

  Scenario: The compact history opens the full timeline
    Given a car with events
    When I tap "Open full timeline" next to History
    Then the Timeline screen opens for that car

  Scenario: Events sit on a rail, newest first, grouped by year
    Given the API returns events from 2024 and 2026
    When I open the full timeline
    Then I see the 2026 group above 2024
    And each event has a dot in its type colour on the rail

  Scenario: Picking a year filters the list and the summary
    Given the summary lists years 2026, 2025
    When I pick 2025
    Then the timeline and the summary are requested with from=2025-01-01 and to=2025-12-31

  Scenario: Type and component filters combine
    When I filter by type Insurance and component Brakes
    Then the requests carry type=INSURANCE and component=BRAKES
    And the filter chips show their counts

  Scenario: Nothing matches
    Given the filtered timeline is empty
    Then I see "No events match these filters"
    And "Clear filters" resets every filter

  Scenario: Costs per currency
    Given the summary has 350 RON and 40 EUR
    Then the summary card shows "350 RON · 40 EUR"

  Scenario: Kilometres not known
    Given the summary distance is empty
    Then the card shows "—" with "needs two odometer readings"

  Scenario: The summary fails but the list works
    Given the summary request fails
    Then the summary card offers retry
    And the events are still listed

  Scenario: Only the current policy shows a marker
    Given an RCA marked SUPERSEDED and an RCA marked EXPIRING in 12 days
    Then only the newer RCA shows "Expires in 12 days"
