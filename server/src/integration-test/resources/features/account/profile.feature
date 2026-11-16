Feature: Profile
  Scenario: First visit creates my profile
    Given I am a new user with email "me@example.com"
    When I open my account
    Then my profile exists with email "me@example.com"
    And I have no display name or phone

  Scenario: Opening my account twice keeps one profile
    Given I am a new user with email "me@example.com"
    When I open my account
    And I open my account
    Then the profile has the same creation time both times

  Scenario: An account without an email claim still opens
    Given I am a new user without an email
    When I open my account
    Then my profile exists without an email

  Scenario: Display name is trimmed
    Given I am a new user with email "me@example.com"
    When I set my display name to "  Ana Pop "
    Then my display name is "Ana Pop"

  Scenario: Clearing a phone number
    Given I am a new user with email "me@example.com"
    And my phone number is "+40712345678"
    When I clear my phone number
    Then I have no display name or phone

  Scenario Outline: Invalid profile values are rejected
    Given I am a new user with email "me@example.com"
    When I set my phone number to "<phone>"
    Then it is rejected with code "validation-failed"
    Examples:
      | phone          |
      | +40 712 345 678 |
      | 0712345678     |
      | +40-712-345-678 |

  Scenario: Statistics count only my own records
    Given I am a new user with email "me@example.com"
    And I own vehicle "WVWZZZ1JZXW000001"
    And Alice owns vehicle "WVWZZZ1JZXW000002"
    When I open my account
    Then my account shows 1 vehicle and 0 events and 0 passports
