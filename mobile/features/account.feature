Feature: Account
  Scenario: Account details
    When I open Account
    Then I see my email, the app version and the 3D model credit

  Scenario: Appearance is remembered
    When I choose "Daylight" and restart the app
    Then "Daylight" is selected

  Scenario: Signing out
    When I choose Sign out
    Then I am returned to sign-in
