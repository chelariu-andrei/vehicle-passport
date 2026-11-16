Feature: Legal pages
  Scenario: Terms open from the sign-up caption while signed out
    Given I am signed out on the sign-up screen
    When I tap Terms in the caption
    Then I read the terms without being sent to sign-in

  Scenario: Legal list shows version and effective date
    When I open the legal documents in Account
    Then I see each document title, version and effective date

  Scenario: Document falls back to English when locale unsupported
    Given the app language is Romanian and the terms exist only in English
    When I open the terms
    Then I read the English terms

  Scenario: Offline shows retry
    Given the legal service cannot be reached
    When I open the legal documents in Account
    Then I see a retry button that loads them
