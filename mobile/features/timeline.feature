Feature: Timeline
  Scenario: Newest first across pages
    Given the API returns events oldest first over 3 pages
    When I open the vehicle
    Then all events are shown newest first

  Scenario: Documented entries only allow notes
    Given a DOCUMENTED event
    When I edit it
    Then only notes can be changed
    And the request resends the original type, date, odometer, cost and currency

  Scenario: Prior-owner entry
    When an edit answers 403 "event-from-prior-owner"
    Then I am told a previous owner added it
    And edit and delete are hidden for that event

  Scenario: A manual entry is saved as confirmed
    When I add an event with default currency
    Then the request has currency "RON"
    And the new entry shows evidence "confirmed"

  Scenario: A decimal comma is understood
    When I add an event costing "149,50"
    Then the request has costAmount 149.5

  Scenario: Deleting explains what stays
    When I choose Delete on an event
    Then I am told existing passports keep this entry

  Scenario: A private invoice
    Given an event with a document
    When I view the invoice and the API answers 403 "document-restricted"
    Then I am told "This invoice stays private to the previous owner."

  Scenario: An invoice can be opened
    Given an event with a document
    When I view the invoice
    Then the system share sheet opens with that file

  Scenario: No invoice, no button
    Given an event without a document
    Then "View invoice" is not offered

  Scenario: Mileage that does not fit
    When saving an event answers 422 "odometer-inconsistent"
    Then I am told "This mileage doesn't fit the car's history. Check the date and kilometres."
    And my input is kept
