Feature: Timeline
  Scenario: Chronological order across owners
    Given V has events by a previous owner and by me
    When I request the timeline
    Then events are in chronological order
    And no event reveals who created it

  Scenario: Timeline paginates without gaps or repeats
    Given V has 5 events
    When I read the timeline 2 at a time
    Then I see all 5 events exactly once, in order

  Scenario: Same-day events keep creation order
    Given V has two events on 2025-03-01 created in sequence
    When I request the timeline
    Then they appear in creation order
