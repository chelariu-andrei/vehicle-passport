Feature: Consent gate
  Scenario: New Apple user is taken to the consent screen
    Given I signed in for the first time and have accepted nothing
    When the app opens
    Then I am on the consent screen

  Scenario: Accept is disabled until the box is ticked
    Given I signed in for the first time and have accepted nothing
    When the app opens
    Then Accept and continue is disabled until I tick the terms box

  Scenario: Optional switches default off
    Given I signed in for the first time and have accepted nothing
    When the app opens
    Then the marketing and analytics switches are off

  Scenario: Accepting with the optional switches records my choices
    Given I signed in for the first time and have accepted nothing
    When I tick the box, turn marketing on and accept
    Then the server records the current versions and marketing, and I land on the garage

  Scenario: Terms open from the consent screen
    Given I signed in for the first time and have accepted nothing
    When I tap Terms on the consent screen
    Then I read the terms

  Scenario: Sign-up with ticked box and pending consent skips the gate
    Given I ticked the terms at sign-up and then confirmed my email
    When the app opens
    Then the consent is recorded as the sign-up form and I land on the garage

  Scenario: Email sign-up without confirmation records the sign-up form once
    Given nobody is signed in and the project does not ask for email confirmation
    When I sign up with email and tick the terms box
    Then I land on the garage without the gate, and one consent is recorded as the sign-up form

  Scenario: A failed sign-up forgets the ticked box
    Given nobody is signed in and the project does not ask for email confirmation
    When I sign up with an email that already has an account
    Then no consent is remembered

  Scenario: Terms that changed since the form was shown are not accepted for me
    Given I ticked the terms at sign-up when the version was older, and then confirmed my email
    When the app opens
    Then I am on the consent screen
    And nothing was recorded and the remembered consent is gone

  Scenario: Versions that could not be read at sign-up are never guessed
    Given nobody is signed in and the project does not ask for email confirmation
    And the legal documents cannot be loaded
    When I sign up with email and tick the terms box
    Then I am on the consent screen
    And nothing was recorded and the remembered consent is gone

  Scenario: A failed automatic acceptance shows the gate
    Given I ticked the terms at sign-up and then confirmed my email
    And the server cannot record consents
    When the app opens
    Then I am on the consent screen

  Scenario: Another account does not inherit the sign-up consent
    Given someone ticked the terms at sign-up as another email and never confirmed
    And I signed in for the first time and have accepted nothing
    When the app opens
    Then I am on the consent screen
    And nothing was recorded and the remembered consent is gone

  Scenario: Pending consent is dropped when nothing is owed
    Given I ticked the terms at sign-up and then confirmed my email
    And I have accepted the current terms
    When the app opens and I reach the garage
    Then the remembered consent is gone
    And a new terms version later shows the gate and records nothing by itself

  Scenario: A hanging automatic acceptance falls back to the gate
    Given I ticked the terms at sign-up and then confirmed my email
    And the server never answers the consent request
    When the app opens and the wait runs out
    Then I am on the consent screen
    And I can sign out from it

  Scenario: New terms version re-opens the gate on focus
    Given I have accepted the current terms and use the app
    When the terms version is raised and the app comes back to the foreground
    Then I am on the consent screen

  Scenario: 409 outdated version reloads the texts
    Given I signed in for the first time and have accepted nothing
    When the terms change while I read, and I accept
    Then I stay on the consent screen with the newest version loaded
    And accepting again records the newest version

  Scenario: Offline shows retry and never opens the app
    Given I signed in for the first time and have accepted nothing
    And my profile cannot be loaded
    When the app opens
    Then I see a retry button and nothing is accepted
    And retrying brings me to the consent screen

  Scenario: Sign out from the gate works
    Given I signed in for the first time and have accepted nothing
    When I sign out from the consent screen
    Then I am on sign-in
