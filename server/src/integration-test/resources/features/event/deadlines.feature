Feature: Document deadlines

  Background:
    Given today is 2026-11-16

  Scenario: An empty car shows six documents, none recorded, in a fixed order
    Given I own vehicle V
    When I request the deadlines of V
    Then the deadlines are ITP, RCA, CASCO, ROVINIETA, FIRE_EXTINGUISHER, FIRST_AID_KIT in that order
    And every deadline is NOT_RECORDED

  Scenario: A renewed RCA replaces the old one
    Given I own vehicle V
    And V has an RCA valid 2025-11-01 to 2026-12-01 and an RCA valid 2026-11-01 to 2027-10-31
    When I request the deadlines of V
    Then the RCA deadline is VALID until 2027-10-31 with 349 days left
    And the RCA deadline points to the newer RCA

  Scenario: An absent CASCO is not recorded
    Given I own vehicle V
    And V has an RCA valid 2025-11-01 to 2026-12-01 and an RCA valid 2026-11-01 to 2027-10-31
    When I request the deadlines of V
    Then the CASCO deadline is NOT_RECORDED

  Scenario: An expired ITP is red with negative days left
    Given I own vehicle V
    And V has an ITP valid until 2026-11-13
    When I request the deadlines of V
    Then the ITP deadline is EXPIRED until 2026-11-13 with -3 days left

  Scenario: An RCA ending in 30 days is expiring
    Given I own vehicle V
    And V has an RCA valid 2025-12-17 to 2026-12-16 and an RCA valid 2024-12-17 to 2025-12-16
    When I request the deadlines of V
    Then the RCA deadline is EXPIRING until 2026-12-16 with 30 days left

  Scenario: Another owner's vehicle is not found
    Given V is owned by another user
    When I request the deadlines of V
    Then the answer is 404 "vehicle-not-found"

  Scenario: An unknown vehicle is not found
    Given I own vehicle V
    When I request the deadlines of an unknown vehicle
    Then the answer is 404 "vehicle-not-found"
