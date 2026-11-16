Feature: Sign-in methods and app lock
  Scenario: The last sign-in method cannot be disconnected
    Given I am signed in with email only
    When I open Sign-in methods
    Then Disconnect is disabled for email and says why
    And removing it directly is refused

  Scenario: Connecting Google shows it connected
    Given I am signed in with email only on Android
    When I open Sign-in methods and connect Google
    Then Google is shown as connected and can be disconnected

  Scenario: Change password validates length
    Given I am on Sign-in methods
    When I try a password that is too short
    Then I see the too short message and nothing is sent
    And a valid password is saved with a confirmation

  Scenario: The app locks after 1 minute in the background and unlocks with biometrics
    Given the app lock is on with a 1 minute timeout
    When I leave the app for 30 seconds and come back
    Then the app is not locked
    When I leave the app for 2 minutes and come back
    Then the app is locked
    When I unlock with biometrics
    Then the app is open again

  Scenario: Failed biometrics keeps the app locked
    Given the app lock is on with a 1 minute timeout
    And I left the app for 2 minutes and came back with biometrics failing
    When I press Unlock and biometrics fail again
    Then the app stays locked

  Scenario: Sign out everywhere else asks for confirmation
    Given I am on Password and security
    When I choose to sign out everywhere else
    Then I am asked to confirm and nothing happens yet
    When I confirm
    Then my other devices are signed out and I am told

  Scenario: The biometric offer appears once and never again after Not now
    Given I have never been offered biometrics
    When I open the app
    Then I am offered biometrics
    When I choose Not now
    Then the offer is gone and it is remembered
    And it does not come back when the app is opened again
