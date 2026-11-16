Feature: Account
  Scenario: Account details
    When I open Account
    Then I see my email and the app version

  Scenario: Appearance is remembered
    When I choose "Daylight" and restart the app
    Then "Daylight" is selected

  Scenario: Signing out
    When I choose Sign out
    Then I am returned to sign-in

  Scenario: Profile card shows name, email and counts
    Given my profile has the name "Ana Pop" and one car and one passport
    When I open Account
    Then I see "Ana Pop", my email and the counts 1 car, 0 entries and 1 passport

  Scenario: Edit name persists after reload
    When I change my name to "Ion Vasile" on Profile and save
    And I open Profile again after a reload
    Then the name field shows "Ion Vasile"

  Scenario: Phone with spaces is normalised and saved
    When I save the phone "+40 712 345 678" on Profile
    Then the phone is sent as "+40712345678"

  Scenario: Invalid phone shows a field error
    When I save the phone "0712" on Profile
    Then I see the phone format error and nothing is sent

  Scenario: Clearing phone sends null
    Given my profile has the phone "+40712345678"
    When I clear the phone on Profile and save
    Then the phone is sent as null

  Scenario: Server validation error is shown under the field
    Given the server will reject the next profile update
    When I change my name to "Ion Vasile" on Profile and save
    Then I see the server message under the name field
    And the name field still shows "Ion Vasile"

  Scenario: Sign out is separate from delete
    When I open Account
    Then Sign out and Delete account are different rows in different groups
