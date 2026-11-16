Feature: Consent
  Scenario: A new user has to consent
    Given I am a new user with email "me@example.com"
    Then my consent is required

  Scenario: Accepting the current terms and privacy clears the requirement
    Given I am a new user with email "me@example.com"
    When I accept terms "1.0" and privacy "1.0"
    Then my consent is not required

  Scenario: Accepting an outdated version is rejected
    Given I am a new user with email "me@example.com"
    When I accept terms "0.9" and privacy "1.0"
    Then it is rejected with code "consent-version-outdated"
    And my consent history is empty

  Scenario: Switching marketing off is recorded as a withdrawal
    Given I am a new user with email "me@example.com"
    When I turn marketing consent on
    And I turn marketing consent off
    Then my latest consent event is marketing withdrawn
