Feature: Data export and account deletion
  Scenario: Delete button disabled until the box is ticked
    Given I am on the delete account screen
    Then Delete my account is disabled
    When I tick I understand
    Then Delete my account is enabled

  Scenario: Scheduling shows the date 30 days out and a dot on the tab
    Given I am on the delete account screen
    When I tick I understand and confirm the deletion
    Then I see Deletion scheduled with the date 30 days out
    And the Account tab shows a dot
    And I am still signed in

  Scenario: Cancel clears the banner and the dot
    Given my deletion is already scheduled and I am on Account
    When I cancel the deletion
    Then the banner is gone
    And the Account tab shows no dot

  Scenario: Scheduling twice shows the existing date
    Given I am on the delete account screen
    And the account already has a deletion scheduled elsewhere
    When I tick I understand and confirm the deletion
    Then I see Deletion scheduled with the date 30 days out

  Scenario: Export shares a JSON file
    Given I am on the delete account screen
    When I download my data
    Then a JSON file with my data is saved in the cache and shared

  Scenario: Export failure shows a toast
    Given I am on the delete account screen
    And the export will fail
    When I download my data
    Then I see the export failed
    And no file is left behind

  Scenario: Export is explained when sharing is unavailable
    Given I am on the delete account screen
    And sharing is unavailable on this device
    When I download my data
    Then I see sharing is unavailable
    And no file was written

  Scenario: Banner persists after sign-out and sign-in
    Given my deletion is already scheduled and I am on Account
    When I sign out and sign in again
    Then the banner is shown on Account
    And the Account tab shows a dot

  Scenario: Lock enabled requires biometrics before scheduling
    Given the app lock is on and I am on the delete account screen
    When I tick I understand and confirm the deletion with biometrics failing
    Then nothing was scheduled
    When I confirm the deletion with biometrics succeeding
    Then I see Deletion scheduled with the date 30 days out
