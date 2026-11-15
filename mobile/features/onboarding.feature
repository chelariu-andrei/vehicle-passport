Feature: Adding a car
  Scenario: The journey starts by itself in an empty garage
    Given I have no cars and no pending claims
    When I open the app
    Then I see "Let's find your car" and "Step 1 of 3"
    And there is no Back button

  Scenario: It does not start while a claim is waiting
    Given I have no cars and one pending claim
    When I open the app
    Then I see "Your garage"

  Scenario: Later leaves and does not ask again this launch
    Given the journey started by itself
    When I choose "Later"
    Then I see "Add your first car"
    And returning to the Car tab does not reopen the journey

  Scenario: The VIN is cleaned as it is typed
    When I type " wba 8e1c50-gk123456"
    Then the field shows "WBA8E1C50GK123456" and "17 / 17"
    And I see "Looks like a BMW"

  Scenario: Continue waits for 17 characters
    When I type "WBA8E1C50GK12345"
    Then "Continue" is disabled

  Scenario: The make is suggested, not imposed
    Given I typed a BMW VIN and continued
    Then Make holds "BMW"
    When I change it to "Alpina" and add the car
    Then the request carries make "Alpina"

  Scenario: Back keeps what I typed
    Given I am on step 2 with a model typed
    When I go back and continue again
    Then the model is still there

  Scenario: A newly registered car becomes the active car
    Given I own a Volkswagen Golf
    When I add a BMW through the journey
    Then the BMW is the active car

  Scenario: A VIN with an owner files a claim
    When I submit a VIN that someone else owns
    Then I see the claim-filed screen and "Done" takes me to the Car tab
    And no car was added

  Scenario: A car I already own is one tap away
    When I submit a VIN that is already mine
    Then I am told "This car is already in your garage."
    And "View car" makes it the active car

  Scenario: The server refuses the VIN
    When the API answers 400 "invalid-vin"
    Then I am on step 1 with the message under the VIN field

  Scenario: Leaving with something typed offers to keep it
    Given I typed a VIN
    When I choose "Later"
    Then I am asked "Keep this draft?"
    When I choose "Keep draft" and open the journey again
    Then the VIN is filled in

  Scenario: Discarding clears the draft
    Given I typed a VIN and chose "Later" then "Discard"
    When I open the journey again
    Then the VIN field is empty

  Scenario: A draft belongs to its account
    Given another account left a draft on this phone
    When I open the journey
    Then the VIN field is empty

  Scenario: A submitted car leaves no draft
    Given I added a car through the journey
    When I open the journey again
    Then the VIN field is empty
