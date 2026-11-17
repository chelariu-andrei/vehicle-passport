Feature: Timeline
  Scenario: Newest first across pages
    Given the API returns events oldest first over 3 pages
    When I open the vehicle
    Then all events are shown newest first
    And every page was requested with order "desc"

  Scenario: The latest kilometres skip entries without kilometres
    Given the newest entry has no kilometres and an older one has 84200
    When I open the vehicle
    Then the car shows 84200 km

  Scenario: Only the current policy shows a marker
    Given two insurance entries, the older superseded by the newer
    When I open the vehicle
    Then exactly one validity marker is shown

  Scenario: The compact history opens the full timeline
    Given a car with history
    When I tap "Open full timeline"
    Then I am on the route "/vehicles/V/timeline"

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

  Scenario: Adding insurance asks for what insurance needs
    When I add an event of type Insurance
    Then I am asked for coverage, insurer and the validity period
    And kilometres are optional

  Scenario: Rovinieta shows its computed end
    When I add a Rovinieta from 15 Jan 2026 for 12 months
    Then the form previews the end date
    And the request carries no validUntil

  Scenario: Other needs a name
    When I add an event of type Other without a name
    Then I cannot save

  Scenario: Safety equipment asks for item and expiry
    When I add an event of type Safety equipment
    Then I choose between fire extinguisher and first-aid kit
    And "valid until" is required

  Scenario Outline: Paperwork can carry its file
    When I add an event of type <type>
    Then the documents section says "<hint>"
    And I can attach a photo or PDF before saving

    Examples:
      | type             | hint                                       |
      | Insurance        | Attach the policy (photo or PDF)           |
      | ITP              | Attach the inspection report               |
      | Rovinieta        | Attach the receipt                         |
      | Safety equipment | Attach the receipt or a photo of the label |

  Scenario: A CASCO saved with its policy file
    When I add a CASCO with insurer "Allianz" and attach "polita.pdf"
    Then the event is created and the file is uploaded to it
    And the entry shows 1 document and evidence "confirmed"

  Scenario: Components are suggested by type
    When I add an event of type Tires
    Then component "Tires and wheels" is preselected

  Scenario: Custom fields
    When I add two custom fields to an event
    Then they are saved on the event in the order I added them

  Scenario: A scanned event lets me tag it
    Given a DOCUMENTED event
    When I edit it
    Then notes, components and custom fields can be changed
    And the request resends the original facts
