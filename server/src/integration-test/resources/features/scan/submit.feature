Feature: Invoice scanner submission and worker
  Scenario: Totals mismatch is flagged
    Given extraction returned parts 300, labor 100, total 500
    Then the result carries a total-mismatch warning

  Scenario: Batch limit
    Given I own vehicle V
    When I submit a batch of 21 files
    Then it is rejected with code "batch-too-large"

  Scenario: Never auto-confirm
    Given extraction finished
    Then no event exists until I confirm

  Scenario: Extraction moves a job to EXTRACTED
    Given I submitted an invoice photo for vehicle V
    When the worker runs
    Then the job is EXTRACTED with confidence on each field

  Scenario: Transient failure is retried, then fails
    Given extraction fails 3 times for my job
    When the worker runs 3 times
    Then the job is FAILED
    And extraction was called 3 times

  Scenario: Failure then success
    Given extraction fails 1 time for my job
    When the worker runs 2 times
    Then the job is EXTRACTED

  Scenario: A job stuck in processing is recovered
    Given a job has been PROCESSING for longer than the timeout
    When the worker runs
    Then the job is EXTRACTED

  Scenario: A stuck job out of attempts fails
    Given a job has been PROCESSING for longer than the timeout and has used 3 attempts
    When the worker runs
    Then the job is FAILED

  Scenario: A batch of 20 creates 20 independent jobs
    Given I own vehicle V
    When I submit a batch of 20 files
    Then 20 PENDING jobs exist in one batch

  Scenario: A bad file rejects the whole batch before anything is stored
    Given I own vehicle V
    When I submit a batch of 3 files where one is a text file named "invoice.pdf"
    Then it is rejected with code "unsupported-file"
    And no file was stored and no job exists

  Scenario: A non-owner cannot scan
    Given V is owned by another user
    When I submit an invoice photo for vehicle V
    Then it is rejected with code "vehicle-not-found"

  Scenario: A job in progress is cancelled when ownership ends
    Given I submitted an invoice photo for vehicle V
    And I released V
    When the worker runs
    Then the job is CANCELLED
    And extraction was not called

  Scenario: Client file name never reaches storage
    Given I own vehicle V
    When I submit a file whose multipart name is "../../x.pdf"
    Then the stored key is the scan key of the job and does not contain "x.pdf"
