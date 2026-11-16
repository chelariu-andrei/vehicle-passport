Feature: Account deletion
  Scenario: Deleting my account is scheduled thirty days ahead
    Given I am a new user with email "me@example.com"
    When I ask to delete my account
    Then my deletion is scheduled 30 days from now
    And my account still opens with the deletion date

  Scenario: Asking twice is rejected
    Given I am a new user with email "me@example.com"
    When I ask to delete my account
    And I ask to delete my account
    Then it is rejected with code "deletion-already-scheduled"

  Scenario: Changing my mind clears the schedule
    Given I am a new user with email "me@example.com"
    When I ask to delete my account
    And I cancel the deletion of my account
    Then no deletion is scheduled

  Scenario: Cancelling without a schedule is rejected
    Given I am a new user with email "me@example.com"
    When I cancel the deletion of my account
    Then it is rejected with code "deletion-not-scheduled"
