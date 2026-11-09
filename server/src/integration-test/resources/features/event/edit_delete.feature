Feature: Edit and delete events
  Scenario: New owner cannot alter prior history
    Given Alice created event E during her ownership period, then ownership moved to me
    When I try to edit or delete E
    Then it is rejected as forbidden

  Scenario: Edit re-validates neighbours
    Given V has events on 2025-01-01 at 100000 km, 2025-06-01 at 110000 km, 2025-12-01 at 120000 km
    When I change the middle event's km to 130000
    Then it is rejected with code "odometer-inconsistent"

  Scenario: Moving an event by date re-validates at its new position
    Given V has events on 2025-01-01 at 100000 km, 2025-06-01 at 110000 km, 2025-12-01 at 120000 km
    When I change the first event's date to 2025-09-01
    Then it is rejected with code "odometer-inconsistent"

  Scenario: Deleted events leave the timeline
    Given V has an event E
    When I delete E
    Then the timeline does not contain E

  Scenario: A deleted event no longer constrains the odometer
    Given V has an event on 2025-06-01 at 200000 km that I deleted
    When I add a SERVICE event on 2025-07-01 at 100000 km costing 10 RON
    Then the event is saved with evidence USER_CONFIRMED

  Scenario: Documented data cannot be rewritten
    Given V has a DOCUMENTED event E at 120000 km
    When I change E's km to 121000
    Then it is rejected with code "documented-event-immutable"

  Scenario: Notes on a documented event can be edited
    Given V has a DOCUMENTED event E at 120000 km
    When I change E's notes to "new battery"
    Then E has evidence DOCUMENTED and notes "new battery"

  Scenario: Returning owner cannot edit events from the earlier period
    Given I created event E, released V, and registered V again
    When I try to edit E
    Then it is rejected as forbidden

  Scenario: A later owner sees that a document exists but cannot open it
    Given Alice attached a document to event E, then ownership moved to me
    When I request E's document
    Then it is rejected as forbidden
    And the timeline shows E with a document present
