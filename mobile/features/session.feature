Feature: Session
  Scenario: An expired token is refreshed once
    Given my access token has expired
    When a request answers 401 with an empty body
    Then the session is refreshed and the request is retried once

  Scenario: A refused refresh signs me out
    Given the retried request also answers 401
    Then I am returned to sign-in

  Scenario: Signed-out users land on sign-in
    Given I am signed out
    When the app opens
    Then I see the sign-in screen

  Scenario: Wrong password is explained
    When I sign in with a wrong password
    Then I am told the email or password is wrong
    And I stay on sign-in

  Scenario: A second account on the same phone sees nothing from the first
    Given I am signed in as "a" with a car in my garage
    When I sign out and sign in as "b"
    Then the garage is empty
