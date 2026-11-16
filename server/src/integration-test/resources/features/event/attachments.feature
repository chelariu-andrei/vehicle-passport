Feature: Event attachments
  Scenario: Add, list, open and delete an attachment
    Given I own vehicle V with an event E
    When I attach the PDF file "receipt-1" to E
    Then the attachment is stored with kind UPLOAD and the SHA-256 of "receipt-1"
    And E lists 1 attachment
    And opening that attachment returns the bytes of "receipt-1" as "application/pdf"
    When I delete that attachment
    Then E lists 0 attachments

  Scenario: The same file cannot be attached twice to one vehicle
    Given I own vehicle V with events E and F
    And the PDF file "receipt-1" is attached to E
    When I attach the PDF file "receipt-1" to F
    Then the attachment request fails with 409 "duplicate-document"
    And the problem detail names E

  Scenario: The same bytes on another user's vehicle are accepted
    Given Alice owns vehicle W with an event that has the PDF file "receipt-1" attached
    And I own vehicle V with an event E
    When I attach the PDF file "receipt-1" to E
    Then the attachment is stored with kind UPLOAD and the SHA-256 of "receipt-1"

  Scenario: A later owner can neither add nor open documents of earlier events
    Given Alice attached the PDF file "receipt-1" to event E, then ownership of V moved to me
    When I attach the PDF file "receipt-2" to E
    Then the attachment request fails with 403 "event-from-prior-owner"
    When I open Alice's attachment of E
    Then the attachment request fails with 403 "document-restricted"

  Scenario: An event holds at most 10 attachments
    Given I own vehicle V with an event E
    And 10 different PDF files are attached to E
    When I attach the PDF file "receipt-11" to E
    Then the attachment request fails with 422 "attachment-limit"

  Scenario: A text file renamed to .pdf is refused
    Given I own vehicle V with an event E
    When I attach a text file declared as "application/pdf" to E
    Then the attachment request fails with 415 "unsupported-file"

  Scenario: Attachments show on the timeline without raising evidence
    Given I own vehicle V with an event E
    And the PDF file "receipt-1" is attached to E
    And the PDF file "receipt-2" is attached to E
    Then the timeline shows E with 2 attachments, a document present and evidence USER_CONFIRMED

  Scenario: The source file of a confirmed scan is a protected attachment
    Given extraction finished
    When I confirm the extracted data
    Then the confirmed event lists one SCAN_SOURCE attachment carrying the scanned file's SHA-256
    When I delete the SCAN_SOURCE attachment of the confirmed event
    Then the attachment request fails with 422 "attachment-protected"

  Scenario: The deprecated document endpoint returns the first attachment
    Given I own vehicle V with an event E
    And the PDF file "receipt-1" is attached to E
    And the PDF file "receipt-2" is attached to E
    When I request E's document through the deprecated alias
    Then I receive the bytes of "receipt-1" as "application/pdf"
