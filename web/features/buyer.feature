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

  Scenario: A buyer sees insurance with its validity
    Given a passport with a CASCO from Allianz valid until a future date
    Then the entry reads "CASCO · Allianz" with its validity range

  Scenario: Superseded paperwork shows no warning
    Given a passport with two RCA policies, the older one expired
    Then only the newer RCA shows a validity marker

  Scenario: A custom event shows its name and fields
    Given a passport with an OTHER event "Ceramic coating" and a custom field "Layers: 3"
    Then the entry shows "Ceramic coating" and "Layers: 3"

  Scenario: An old passport still renders
    Given a passport snapshot from before this change
    Then every entry renders as before

  Scenario: Text typed into the new fields cannot inject markup
    Given a passport with an OTHER event "<script>alert(1)</script>" and a custom field "<b>x</b>: <i>y</i>"
    Then it is displayed as plain text
    And the page contains no raw "<b>x</b>" markup

  Scenario: Safety equipment shows the item and its expiry marker
    Given a passport with a fire extinguisher expiring in 10 days
    Then I see "Fire extinguisher"
    And I see "Expires in 10 days"

  Scenario: An expired rovinieta says so and an ITP without an end date shows no marker
    Given a passport with an ITP without validUntil and a rovinieta that expired
    Then I see "Expired"
    And the page has 1 validity marker

  Scenario: The validity rules at their edges
    Given policies ending 31 days, 30 days, 0 days from today and yesterday, plus two RCA with the same start
    Then the statuses are VALID, EXPIRING, EXPIRING and EXPIRED, and the later of the tied RCA wins
