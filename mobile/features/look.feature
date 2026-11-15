Feature: The car's look
  Scenario: Step three follows a new car
    Given I added a car through the journey
    Then I see "Step 3 of 3", the five topics and no Back button

  Scenario: Saving sends the whole look once
    Given I am on step three
    When I choose SUV, Blue, Matte, Aero wheels, black rims, dark tint, a black roof and the plate "b 123 abc"
    And I choose "Save this look"
    Then one update is sent with appearance {bodyType SUV, color BLUE, finish MATTE, wheels AERO, rimColor BLACK, glassTint DARK, contrastRoof true} and plate "B 123 ABC"
    And I see "… is in your garage"

  Scenario: Skipping sends nothing
    When I choose "Skip for now"
    Then no update is sent and I see "… is in your garage"

  Scenario: An empty plate is sent as none
    When I save without typing a plate
    Then the update carries plate null

  Scenario: A strange plate is tamed
    When I type "b-12🙂abc  def ghi" as the plate
    Then the field shows at most 10 characters, upper case, with single spaces

  Scenario: Any colour is filed under a named one
    When I open "Any colour" and move the hue to blue
    Then I see "filed under blue"
    And saving sends a colorHex and color BLUE

  Scenario: Picking a named colour drops the custom shade
    Given I chose a custom shade
    When I choose "Red" and save
    Then the update carries color RED and no colorHex

  Scenario: The stage turns to the topic
    When I open "Plate"
    Then the viewer is told to turn to "rear"

  Scenario: The look works without 3D
    Given the viewer reports an error
    Then I see the silhouette, and choosing "Pickup" changes it
    And saving still sends bodyType PICKUP

  Scenario: Saving fails
    Given the API answers 503 to the update
    When I choose "Save this look"
    Then I stay on step three with "Something went wrong. Try again."
    And "Skip for now" still shows "… is in your garage"

  Scenario: Add first service scans for this car
    Given I am on the last screen
    When I choose "Add first service"
    Then the capture screen opens for the new car's VIN

  Scenario: Later lands on the Car tab
    When I choose "Later" on the last screen
    Then the title is the new car's name

  Scenario: A car without a look is offered one
    Given I own a car with no appearance
    Then the home screen shows "Make it yours"
    When I dismiss it and reopen the app
    Then it is not shown

  Scenario: Changing the look later
    Given I own a red sedan
    When I choose "Change look" from the car's options, choose "Estate" and save
    Then the update carries bodyType ESTATE and color RED
    And Back returns to the home screen

  Scenario: The plate never reaches a passport screen
    Given my car has plate "B 123 ABC" and a passport
    When I open the passport
    Then "B 123 ABC" is not on the screen
