Feature: Apple and Google sign-in, validated auth forms
  Scenario: Apple button appears first on iOS
    Given I am on iOS and signed out
    When I open sign-in
    Then the Apple button comes before the Google button

  Scenario: Android shows only the Google button
    Given I am on Android and signed out
    When I open sign-in
    Then I see the Google button and no Apple button

  Scenario: Google sign-in succeeds and lands on the garage
    Given I am on Android and signed out
    And Google will sign me in
    When I continue with Google
    Then I land on the garage

  Scenario: Cancelling Google shows nothing
    Given I am on Android and signed out
    And I cancel the Google sheet
    When I continue with Google
    Then I stay on sign-in with no message

  Scenario: Email already used with Apple shows the other-provider message
    Given I am on Android and signed out
    And the email is already registered with another provider
    When I continue with Google
    Then I am told to sign in with my original method

  Scenario: Sign-up needs the terms box
    Given I am on the sign-up screen
    When I fill in the form without accepting the terms
    Then the create account button is disabled
    And ticking the terms enables it

  Scenario: Invalid email shows error under the field and keeps the value
    Given I am on the sign-up screen
    When I submit an invalid email
    Then the email field shows the invalid email message
    And the email field still holds what I typed

  Scenario: Wrong password shows the mismatch message
    Given I am on sign-in
    When I sign in with a wrong password
    Then I am told the email or password is wrong

  Scenario: Forgot password sends a reset and confirms
    Given I am on sign-in
    When I ask for a password reset for my email
    Then a reset email is sent and I see the confirmation

  Scenario: Confirmation sign-up remembers the accepted terms
    Given the project asks for email confirmation
    When I create an account with the terms accepted
    Then I am asked to check my email and the consent is remembered

  Scenario: The legal links open the legal screens
    Given I am on the sign-up screen
    When I tap Terms in the caption
    Then I am taken to the terms
