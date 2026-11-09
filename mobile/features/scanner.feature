Feature: Scanner
  Scenario: A HEIC photo is converted
    When I pick a HEIC photo
    Then the upload is a JPEG under 10 MB

  Scenario: Large photos are reduced before upload
    When I pick a 12000 by 9000 pixel photo
    Then the upload's long edge is at most 4096 px

  Scenario: The batch limit is enforced on the device
    When I try to add a 21st photo
    Then it is not added and I am told the limit is 20

  Scenario: PDFs are not offered
    When I open capture
    Then I can only take or choose photos

  Scenario: Scans survive an app restart
    Given a job is PROCESSING
    When I restart the app
    Then the job is still in my inbox and keeps updating

  Scenario: One photo is one job
    When I upload one photo
    Then a single scan is requested with part "file"

  Scenario: Several photos are one batch
    When I upload three photos
    Then one batch is requested with three "files" parts
    And my inbox has three rows, each with its own photo

  Scenario: A bad photo is named before anything is sent
    Given the second of three photos cannot be prepared
    When I upload them
    Then I am told which photo is the problem
    And no request is sent

  Scenario: A failed scan can be retried from the kept photo
    Given a job is FAILED
    When I choose Retry
    Then a new job replaces the old row

  Scenario: A cancelled scan explains itself
    Given a job is CANCELLED
    Then I see "Cancelled: this car left your garage"

  Scenario: An orphaned job is dropped
    When polling a job answers 404 "scan-not-found"
    Then its row is removed

  Scenario: No car to scan for
    Given I have no cars
    When I start a scan
    Then I am told to add a car first and offered Add vehicle

  Scenario: The one-photo rule is stated
    When I open capture
    Then I see "One photo per invoice"

  Scenario: One car skips the car picker
    Given I have one car
    When I start a scan
    Then I go straight to capture

  Scenario: Camera access refused
    Given camera permission is denied
    When I choose Take photo
    Then I am told how to allow it
