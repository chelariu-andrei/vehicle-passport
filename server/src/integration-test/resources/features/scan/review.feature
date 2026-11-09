Feature: Invoice scanner review
  Scenario: Confirm an extracted invoice
    Given extraction finished
    When I confirm the extracted data
    Then an event with evidence DOCUMENTED is added to V
    And the original file is attached to the event

  Scenario: Corrections are saved
    Given an extracted result with km 12000
    When I confirm with corrected km 120000
    Then the event stores km 120000

  Scenario: Defaults at confirmation
    Given an extracted result
    When I confirm without choosing type or currency
    Then the event has type SERVICE and currency RON

  Scenario: Details are stored on the event
    Given an extracted result with parts, labor and service name
    When I confirm the extracted data
    Then the event details hold the service name, parts and labor

  Scenario: Mismatched totals can still be confirmed
    Given extraction returned parts 300, labor 100, total 500
    When I confirm the extracted data
    Then an event with evidence DOCUMENTED is added to V

  Scenario: A contradictory odometer blocks confirmation until corrected
    Given V has an event on 2025-03-01 at 120000 km
    And an extracted result dated 2025-06-01 with km 12000
    When I confirm the extracted data
    Then it is rejected with code "odometer-inconsistent"
    And the job is still EXTRACTED
    When I confirm with corrected km 125000
    Then an event with evidence DOCUMENTED is added to V

  Scenario: A job cannot be confirmed twice
    Given a job I already confirmed
    When I confirm the extracted data
    Then it is rejected with code "scan-state-conflict"
    And V has exactly one event from that job

  Scenario: Rejecting creates no event
    Given an extracted result
    When I reject it
    Then the job is REJECTED and no event exists

  Scenario: A former owner cannot confirm
    Given an extracted result
    And ownership of V moved to Alice
    When I confirm the extracted data
    Then it is rejected with code "vehicle-not-found"
    And no event exists

  Scenario: Batch jobs confirm independently and in any order
    Given a batch of 2 extracted jobs for V
    When I confirm the second and then reject the first
    Then one event exists and each job has its own state

  Scenario: A scan read after ownership ended is cancelled
    Given an extracted result
    And I released V
    Then the job is CANCELLED
    And the stored job is CANCELLED
    And no event exists

  Scenario: Confirming after release is refused and cancels the scan
    Given an extracted result
    And I released V
    When I confirm the extracted data
    Then it is rejected with code "vehicle-not-found"
    And the stored job is CANCELLED
    And no event exists

  Scenario: Confirming in a later ownership period cancels the scan
    Given an extracted result
    And I released V
    And I own V again
    When I confirm the extracted data
    Then it is rejected with code "scan-state-conflict"
    And the stored job is CANCELLED
    And the job is CANCELLED
    And no event exists

  Scenario: Rejecting in a later ownership period cancels the scan
    Given an extracted result
    And I released V
    And I own V again
    When I reject it
    Then it is rejected with code "scan-state-conflict"
    And the stored job is CANCELLED
