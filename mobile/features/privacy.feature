Feature: Privacy choices
  Scenario: Privacy choices show what I chose
    Given I agreed to product news and refused usage analytics
    When I open Privacy choices
    Then marketing is on and analytics is off

  Scenario: Turning marketing off is recorded as made in settings
    Given I agreed to product news and refused usage analytics
    When I open Privacy choices and turn marketing off
    Then the server records marketing off from settings, without touching the terms
    And it is still off when I come back

  Scenario: A choice that cannot be saved goes back
    Given I agreed to product news and refused usage analytics
    And the server cannot record consents
    When I open Privacy choices and turn marketing off
    Then marketing is on again and I am told it was not saved

  Scenario: Privacy choices are reachable from the account
    Given I am on the account tab
    When I open Privacy choices from the list
    Then I see the Privacy choices screen
