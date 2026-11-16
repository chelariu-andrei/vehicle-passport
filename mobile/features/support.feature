Feature: Support and acknowledgements
  Scenario: Report under 10 characters shows an error
    Given I am writing to support
    When I send the report "too short"
    Then I see the message is too short
    And nothing was sent

  Scenario: Diagnostics switch off sends no diagnostics
    Given I am writing to support
    When I send the report "The scanner keeps failing on my invoices" with diagnostics off
    Then the report was sent without diagnostics

  Scenario: Diagnostics switch on sends the listed fields
    Given I am writing to support
    When I send the report "The scanner keeps failing on my invoices" with diagnostics on
    Then the report was sent with the app version, platform, system version and device model

  Scenario: Successful report shows confirmation and clears the form
    Given I am writing to support
    When I send the report "The scanner keeps failing on my invoices" with diagnostics off
    Then I see the report was sent
    And the message field is empty

  Scenario: Offline keeps the draft
    Given I am writing to support
    And the server cannot be reached
    When I send the report "The scanner keeps failing on my invoices" with diagnostics off
    Then I see the report could not be sent
    And the message field still holds my draft
    And sending again after the connection returns works

  Scenario: Acknowledgements list includes expo-router
    When I open the acknowledgements
    Then I see expo-router in the list
    And tapping it shows its licence text
