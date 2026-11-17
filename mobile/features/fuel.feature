Feature: Fuel and cost per km

  Scenario: A fill-up is added from the car screen without a unit price
    Given a diesel car with no fill-ups
    When I open Fuel from the car screen
    And I add a fill-up of 38.2 litres for 312 at 84210 km
    Then the fill-up is saved with quantity 38.2, total 312 and no unit price

  Scenario: An electric car counts energy and asks how it was charged
    Given an electric car with no fill-ups
    When I open the new fill-up form
    Then I see the energy field and the charging choice
    And I do not see the fuel grade choice

  Scenario: A partial fill-up produces no consumption
    Given a diesel car with a full tank at 10000 km and a partial fill-up at 10300 km
    When I open Fuel
    Then no consumption is shown anywhere

  Scenario: The alert card appears when the server reports a sudden increase
    Given the server reports consumption of 8.4 against 6.9 usual
    When I open Fuel
    Then I read the alert with both numbers

  Scenario: The Standard vs Premium comparison needs enough data
    Given the server reports no grade comparison
    When I open Fuel
    Then I do not see the Standard vs Premium card
