Feature: Car context
  Scenario: The first car is active
    Given I own a Volkswagen Golf and a Dacia Duster
    When I open the app
    Then the title is "Volkswagen Golf"
    And I see the Golf's history

  Scenario: Switching car changes the home screen
    Given I own a Volkswagen Golf and a Dacia Duster
    When I open the car list and choose "Dacia Duster"
    Then the title is "Dacia Duster"
    And I see the Duster's history and not the Golf's
    And "Now showing Dacia Duster" is announced

  Scenario: The choice survives a restart
    Given I chose the Dacia Duster
    When I open the app again
    Then the title is "Dacia Duster"

  Scenario: One car has nothing to switch
    Given I own one car
    Then the title is not a button

  Scenario: One car can still add another
    Given I own one car
    When I choose Add a car from the overflow menu
    Then onboarding step 1 opens

  Scenario: The plate sits under the name, or the VIN without one
    Given a car with plate "B 123 ABC" and a car with no plate
    Then the first shows "B 123 ABC" and the second shows its VIN

  Scenario: The active car leaves the account
    Given I own two cars and the active one is transferred away
    When the app refetches
    Then the other car is active and I am told the first is no longer in my garage

  Scenario: A car link makes that car active
    When I open "/vehicles/{the Duster's VIN}"
    Then the title is "Dacia Duster"

  Scenario: Claims and adding a car live in the car list
    Given I have a pending claim
    When I open the car list
    Then I see "Waiting for the current owner" and "Add a car"

  Scenario: The car list never runs a live stage
    Given I own two cars
    When I open the car list
    Then exactly one WebView is mounted

  Scenario: History is grouped by year, newest first
    Given the Golf has entries in 2026 and 2024
    Then I see the label "2026" above the label "2024"
    And each entry shows its evidence level

  Scenario: Empty garage
    Given I have no cars and "Later" was chosen
    Then the title is "Your garage" and I see "Add your first car"
