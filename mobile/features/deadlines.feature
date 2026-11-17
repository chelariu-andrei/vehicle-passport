Feature: Document status

  Scenario: A fresh car shows six documents, none of them an offence
    Given a car with no documents recorded
    When I open Document status
    Then I see the six documents in order ITP, RCA, CASCO, Rovinietă, Fire extinguisher, First-aid kit
    And every one of them reads "Not added"

  Scenario: An expiring document shows its date and the days left
    Given an RCA valid for another 12 days
    When I open Document status
    Then the RCA reads "Expiring" with "12 days"

  Scenario: An expired document says how long ago
    Given an RCA that expired 3 days ago
    When I open Document status
    Then the RCA reads "Expired" with "expired 3 days ago"

  Scenario: CASCO is optional
    Given a car with no documents recorded
    When I open Document status
    Then the CASCO row reads "Optional · Add"

  Scenario: Adding a missing document opens the form with it chosen
    Given a car with no documents recorded
    When I tap the RCA row
    Then the new event form opens for an RCA insurance

  Scenario: A recorded document opens its entry
    Given an RCA valid for another 100 days
    When I tap the RCA row
    Then that event's details open

  Scenario: The footer shows the reminder days
    Given reminders are on for 30, 7 and 1 days
    When I open Document status
    Then I read "Reminders: 30, 7 and 1 day before, and on the expiry day"
    And "Notification settings" opens the notifications screen

  Scenario: Reminders are off
    Given document deadlines are switched off
    When I open Document status
    Then I read "Reminders are off"

  Scenario: The status fails to load
    Given the status request fails once
    When I open Document status
    Then I can retry and then see the six documents
