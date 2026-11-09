Feature: Scan review
  Scenario: Nothing is saved without confirmation
    Given a job is EXTRACTED
    Then no event exists until I press confirm

  Scenario: Low confidence does not block
    Given a field has confidence 0.5
    Then it is marked "Check"
    And I can still confirm

  Scenario: Contradictory mileage is correctable
    When confirm answers 422 "odometer-inconsistent"
    Then my edits are kept and the odometer field is highlighted

  Scenario: Type and currency are always shown
    Given a job is EXTRACTED
    Then I see the type "Service" and the currency "RON"

  Scenario: A total mismatch is shown and does not block
    Given a job warns TOTAL_MISMATCH
    Then I see the warning
    And I can still confirm

  Scenario: A part with no quantity must be completed
    Given a part with no quantity
    When I confirm
    Then the quantity is highlighted and no request is sent

  Scenario: Confirming twice sends once
    When I press confirm twice
    Then one confirmation is requested

  Scenario: The job changed underneath me
    When confirm answers 409 "scan-state-conflict"
    Then the current status is shown

  Scenario: Rejecting asks first
    When I choose Reject and confirm
    Then the job leaves my inbox

  Scenario: The next invoice in a batch
    Given two extracted jobs from one batch
    When I confirm the first
    Then the second opens

  Scenario: The local photo is gone
    Given the job's local photo no longer exists
    When I open Review
    Then the form works without the preview
