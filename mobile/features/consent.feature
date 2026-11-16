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

  Scenario: A failed automatic acceptance shows the gate
    Given I ticked the terms at sign-up and then confirmed my email
    And the server cannot record consents
    When the app opens
    Then I am on the consent screen

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
