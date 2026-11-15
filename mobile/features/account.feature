Feature: Account
  Scenario: Account details
    When I open Account
    Then I see my email and the app version

  Scenario: Appearance is remembered
    When I choose "Daylight" and restart the app
    Then "Daylight" is selected

  Scenario: Signing out
    When I choose Sign out
    Then I am returned to sign-in
