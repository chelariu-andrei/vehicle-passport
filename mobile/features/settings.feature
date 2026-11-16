Feature: Settings
  Scenario: Switching to Română re-renders the Account tab at once
    Given I am on the Account tab in English
    When I choose Română on the Language screen and go back
    Then the Account tab is in Romanian

  Scenario: Toggling a notification persists
    When I switch off activity from scans on the Notifications screen
    And I open the Notifications screen again after a reload
    Then activity from scans is off

  Scenario: Reminder chips 30/7/1 toggle individually
    When I turn off the 7 day reminder
    Then only the 30 day and 1 day reminders are on

  Scenario: Product news is off by default
    When I open the Notifications screen
    Then product news is off

  Scenario: Failed save reverts the switch and shows a toast
    Given the server will reject the next settings save
    When I switch off activity from scans on the Notifications screen
    Then activity from scans is on again and I see the save failed message

  Scenario: Units and currency persist
    When I choose miles and euro on the Units screen
    And I open the Units screen again after a reload
    Then miles and euro are selected

  Scenario: Appearance is remembered
    When I choose "Daylight" on the Appearance screen and restart the app
    Then "Daylight" is selected on the Appearance screen
