Feature: Passport
  Scenario: Expiry comes from the server
    Given a passport whose status is EXPIRED
    Then it is shown as expired, without a QR code

  Scenario: A passport for a sold car stays manageable
    Given my passport's VIN is no longer in my garage
    Then it is listed under its VIN and I can revoke it

  Scenario: The freeze is explained before creating
    When I open Create passport
    Then I am told later events will not appear

  Scenario: No expiry sends no date
    When I create a passport with "No expiry"
    Then the request has no body

  Scenario: A live passport can be shared
    Given an ACTIVE passport
    Then I see its QR code, Share link, Save PDF and See what a buyer sees

  Scenario: Revoking asks first
    Given an ACTIVE passport
    When I choose Revoke and confirm
    Then it is shown as revoked, without a QR code

  Scenario: Passports are never called verified
    Given an ACTIVE passport
    Then I see "Frozen snapshot"
    And the word "verified" does not appear

  Scenario: The buyer view opens the public page
    When I choose See what a buyer sees
    Then the in-app browser opens the passport's publicUrl

  Scenario: Saving the PDF
    When I choose Save PDF
    Then the system share sheet opens with a PDF
