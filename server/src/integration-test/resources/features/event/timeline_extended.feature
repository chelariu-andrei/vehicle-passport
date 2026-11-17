Feature: Extended timeline

  Background:
    Given I own vehicle V

  Scenario: Legacy request still accepted
    When I add a SERVICE event with only the original fields: 2025-03-01, 1000 km, 10 RON
    Then the event is saved with no components, no custom fields and no validity

  Scenario: Insurance requires coverage and insurer
    When I add an INSURANCE event without details
    Then the answer is 400 "validation-failed"

  Scenario: CASCO is stored with its validity
    When I add an INSURANCE event with coverage CASCO, insurer "Allianz", valid 2026-03-12 to 2027-03-11
    Then the event shows coverage CASCO and validUntil 2027-03-11
    And its odometer is empty

  Scenario: Rovinietă end date is computed by the server
    When I add a ROVINIETA event valid from 2026-01-15 for TWELVE_MONTHS
    Then validUntil is the date the official rule gives for that start

  Scenario: A client may not set the rovinietă end date
    When I add a ROVINIETA event with a validUntil
    Then the answer is 400 "validation-failed"

  Scenario: Other needs a label
    When I add an OTHER event without customLabel
    Then the answer is 400 "validation-failed"

  Scenario: Safety equipment needs an expiry date
    When I add a SAFETY_EQUIPMENT event for FIRE_EXTINGUISHER without validUntil
    Then the answer is 400 "validation-failed"

  Scenario: A scanned ITP carries its expiry and a documented reading
    When I confirm a scan as ITP with serviceName "RAR Iasi", odometer 120000 km, validUntil 2028-03-01 and result PASSED
    Then the event has evidence DOCUMENTED, details kind ITP with station "RAR Iasi" and validUntil 2028-03-01

  Scenario: An ITP with an uploaded report stays confirmed
    Given V has a manual ITP event
    When I attach a PDF report to it
    Then its evidence is still USER_CONFIRMED

  Scenario: Validity fields on a non-ITP scan are refused
    When I confirm a scan as SERVICE with a validUntil
    Then the answer is 400 "validation-failed"
    And the job is still EXTRACTED

  Scenario: A scanned ITP station longer than 100 characters is refused
    When I confirm a scan as ITP with a 101-character serviceName
    Then the answer is 400 "validation-failed"

  Scenario: Custom fields are kept in order
    When I add an OTHER event "Ceramic coating" with custom fields "Layers"="3" and "Warranty"="5 years"
    Then the event shows those custom fields in that order

  Scenario: More than ten custom fields are refused
    When I add an event with 11 custom fields
    Then the answer is 400 "validation-failed"

  Scenario: An unknown component is refused
    When I add a SERVICE event tagged "WINGS"
    Then the answer is 400 "validation-failed"

  Scenario: An event without kilometres does not break the odometer check
    Given V has a SERVICE at 2025-01-10 with 100000 km
    When I add an INSURANCE event on 2025-02-01 without kilometres
    And I add a SERVICE at 2025-03-01 with 101000 km
    Then both are accepted

  Scenario: A scanned event accepts new components and custom fields
    Given V has a DOCUMENTED event
    When I change its components to BRAKES and add a custom field
    Then the change is saved
    But changing its cost is refused with 422 "documented-event-immutable"

  Scenario: Type change with leftover details refused
    Given V has an INSURANCE RCA event
    When I change it to a SERVICE that still carries the insurance details
    Then the answer is 400 "validation-failed"

  Scenario: Type change with leftover validity refused
    Given V has an INSURANCE RCA event
    When I change it to a SERVICE that still carries the validity
    Then the answer is 400 "validation-failed"

  Scenario: A rule breach on an old field keeps its business code
    When I add a SERVICE event dated in the future
    Then the answer is 422 "invalid-event"

  Scenario Outline: Filtering the timeline
    Given V has a SERVICE tagged ENGINE in 2024, a REPAIR tagged BRAKES in 2025 and an INSURANCE RCA in 2025
    When I request the timeline with <query>
    Then I see <result>

    Examples:
      | query                            | result                 |
      | type=REPAIR&type=INSURANCE       | the REPAIR and the RCA |
      | component=BRAKES                 | the REPAIR             |
      | from=2025-01-01&to=2025-12-31    | the REPAIR and the RCA |
      | component=ENGINE&from=2025-01-01 | nothing                |

  Scenario: Newest first, paged without gaps
    Given V has 5 events
    When I read the timeline 2 at a time with order=desc
    Then I see all 5 events exactly once, newest first

  Scenario: Newest first across same-moment ties
    Given V has 5 events on 2025-03-01 recorded at the same moment
    When I read the timeline 2 at a time with order=desc
    Then I see all 5 events exactly once, newest first

  Scenario: A cursor is bound to its order
    Given I hold a cursor from an ascending page
    When I use it with order=desc
    Then the answer is 400 "invalid-cursor"

  Scenario: An inverted period is refused
    When I request the timeline with from=2025-12-31&to=2025-01-01
    Then the answer is 400 "validation-failed"

  Scenario: Only the current policy carries a live status
    Given today is 2026-11-16
    And V has an RCA valid 2024-11-01 to 2025-10-31 and an RCA valid 2025-11-01 to 2026-12-01
    When I request the timeline
    Then the older RCA has validityStatus SUPERSEDED
    And the newer RCA has validityStatus EXPIRING

  Scenario: RCA and CASCO are separate groups
    Given today is 2026-11-16
    And V has a current RCA and an older CASCO that expired
    When I request the timeline
    Then the RCA is VALID or EXPIRING
    And the CASCO is EXPIRED

  Scenario: The status is right on a filtered page
    Given today is 2026-11-16
    And V has an RCA from 2024 and a newer RCA from 2026
    When I request the timeline with to=2024-12-31
    Then the 2024 RCA has validityStatus SUPERSEDED

  Scenario: Extinguisher and first-aid kit are separate groups
    Given today is 2026-11-16
    And V has a FIRST_AID_KIT valid until 2027-05-01 and a FIRE_EXTINGUISHER that expired on 2026-01-01
    When I request the timeline
    Then the first-aid kit is VALID
    And the extinguisher is EXPIRED

  Scenario: A renewed extinguisher supersedes the old one
    Given today is 2026-11-16
    And V has a FIRE_EXTINGUISHER valid until 2026-01-01
    When I add a FIRE_EXTINGUISHER valid until 2027-01-01
    Then the older one has validityStatus SUPERSEDED and stays in the timeline
    And the new one has validityStatus VALID

  Scenario: Deleting the current entry revives the previous one
    Given today is 2026-11-16
    And V has an RCA valid 2025-11-01 to 2026-12-01 and an RCA valid 2026-11-01 to 2027-10-31
    When I delete the newer RCA
    And I request the timeline
    Then the older RCA has validityStatus EXPIRING

  Scenario: A changed entry is rated against the whole history
    Given today is 2026-11-16
    And V has an RCA valid 2024-11-01 to 2025-10-31 and an RCA valid 2025-11-01 to 2026-12-01
    When I change the older RCA's insurer
    Then the changed RCA comes back with validityStatus SUPERSEDED

  Scenario: A scanned ITP without expiry is the current ITP with an unknown status
    Given today is 2026-11-16
    When I confirm a scan as ITP without validUntil
    And I request the timeline
    Then the ITP has validityStatus UNKNOWN

  Scenario Outline: An unknown filter value is refused
    When I request the timeline with <query>
    Then the answer is 400 "validation-failed"

    Examples:
      | query          |
      | type=PAINTING  |
      | component=WING |

  Scenario: Summary per currency
    Given V has events costing 100 RON, 250 RON and 40 EUR
    When I request the summary
    Then costByCurrency is 350 RON and 40 EUR

  Scenario: Kilometres driven in a year
    Given V has readings 90000 km on 2024-12-20, 95000 km on 2025-06-01 and 102000 km on 2025-12-01
    When I request the summary for 2025
    Then distance is 12000 km from 90000 to 102000

  Scenario: Kilometres ignore the type filter
    Given V has a SERVICE at 100000 km and a REPAIR at 104000 km in 2025
    When I request the summary for 2025 with type=SERVICE
    Then distance is 4000 km
    And the summary counts 1 SERVICE

  Scenario: Not enough readings
    Given V has one reading in 2025
    When I request the summary for 2025 with no earlier readings
    Then distance km is empty

  Scenario: Years ignore filters
    Given V has events in 2023 and 2025
    When I request the summary with type=ITP
    Then years are 2025 and 2023
    And the summary counts no events
