Feature: Buyer web page
  Scenario: A buyer opens a live passport
    When the page loads a valid token
    Then I see the vehicle, its events with evidence, and the hash
    And no owner data appears

  Scenario: Unavailable public link
    When the API answers 404
    Then I see one message, with no reason given

  Scenario: Scanned text cannot inject markup
    Given an event's notes contain "<script>"
    Then it is displayed as plain text

  Scenario: Every response protects the token
    When the page loads any token
    Then the response has "Referrer-Policy: no-referrer"
    And "Cache-Control: no-store"
    And "X-Robots-Tag: noindex"

  Scenario: The PDF is streamed through
    When I open the PDF of a valid token
    Then I receive application/pdf from the API without an Authorization header

  Scenario: Money is shown as the snapshot gives it
    Given an event costing "149.50"
    Then the page shows "149.50"

  Scenario: An event with no parts detail
    Given an event without "parts"
    Then the page still renders

  Scenario: Evidence is stated, never upgraded
    Given an event with evidence "DOCUMENTED"
    Then I see "Documented"
    And the word "Verified" does not appear

  Scenario: The API is down
    When the API cannot be reached
    Then I see a temporary-problem message and status 502

  Scenario: A snapshot that cannot be read
    Given the API returns a snapshot with no vehicle
    Then I see a temporary-problem message and status 502
