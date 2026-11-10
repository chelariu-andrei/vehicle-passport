# PaddleOCR receipt extraction (Quarkus side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a stored invoice photo into a `ScanResult` by calling the `infra/ocr` service and parsing its text lines with a deterministic pure-Java parser, behind the existing `ReceiptExtractionPort`.

**Architecture:** `PaddleOcrExtractionAdapter` (`scan/infrastructure/client`) posts the image through `OcrHttpClient` and hands the resulting `OcrDocument` to `ReceiptParser` (`scan/domain/model`, no I/O). A runtime flag chooses between this adapter and the existing no-provider adapter. Nothing in the parser interprets OCR text beyond a fixed label dictionary and fixed regexes.

**Tech Stack:** Java 25, Quarkus 3.40.1.1, `java.net.http.HttpClient`, Jackson (already on the classpath), JUnit 5, Cucumber via `quarkus-cucumber`, ArchUnit, JDK `com.sun.net.httpserver` as the HTTP stub. No new Maven dependency.

**Spec:** `docs/superpowers/specs/2026-11-09-paddleocr-extraction-design.md`

**Path shorthand:** `M/` = `server/src/main/java/com/vehiclepassport/server/` · `U/` = `server/src/test/java/com/vehiclepassport/server/` · `I/` = `server/src/integration-test/java/com/vehiclepassport/server/` · `F/` = `server/src/integration-test/resources/features/` · `R/` = `server/src/test/resources/`.

**Commands** (run from the Bash tool; in PowerShell every `-D…` argument must be double-quoted):

| Name | Command | Use |
|---|---|---|
| `UNIT <Class>` | `mvn -f server/pom.xml -B -ntp test -Dtest=<Class>` | one unit test class |
| `FAST` | `mvn -f server/pom.xml -B -ntp verify -Dquarkus.build.skip=true -Dit.test=BehaviourIT` | ArchUnit, unit tests, all Gherkin, no DB |
| `FULL` | `mvn -f server/pom.xml -B -ntp verify` | everything, Docker required |

## Global Constraints

- No LLM anywhere. A value is either a literal reading of OCR text or empty: `new ExtractedField<>(null, 0.0)`. Never a default such as km = 0.
- Arithmetic only checks values, it never produces one.
- Allowed digit repair, numeric-only tokens that contain at least one real digit: `O→0`, `l→1`, `I→1`. Nothing else.
- Numeric or date field whose contributing lines score `< 0.50` → emptied, warning `LOW_CONFIDENCE_READ`. Text fields keep the value with its real low confidence.
- `confidence = min(scores of the lines that contributed the value)`, `× 0.7` when the label matched fuzzily (edit distance 1). The 0.50 test uses the raw score, before `× 0.7`.
- Caps: service name 120 chars, part name 120 chars, 100 parts. Control characters stripped.
- OCR text is never logged at INFO and never placed in an exception message or `failureReason`. Log counts and scores only.
- Regexes are linear-time: no nested quantifiers.
- `ReceiptParser` and its helpers import `java.*` and `scan.domain` only (enforced by the existing `domain_is_pure` rule).
- `scan.ocr.base-url` default `http://127.0.0.1:8090`, `scan.ocr.timeout` default 90 s.
- `server/pom.xml` and `application.properties` hold unrelated uncommitted work and this plan does not edit them. Stage only the paths each task lists; `infra/ocr`, the compose file and the spec stay untouched.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Plan Decisions (gaps or contradictions in the spec — reject any at review)

| # | Decision | Why |
|---|---|---|
| P1 | **VAT is parsed** (spec §7 recommendation). It is carried beside the result, not in `ScanResult`, so persistence and the API stay unchanged. The validator compares against `total − vat` | The validator only runs in the worker, so nothing needs VAT after extraction. Dropping this decision removes one field and one overload |
| P2 | The port returns a new `ReceiptExtraction(result, vat, warnings)` | `ScanResult` has no warning channel, and §6.4 requires parser warnings. This is the one change to the scan flow beyond the adapter |
| P3 | New `ScanWarning` codes: `LOW_CONFIDENCE_READ`, `TOTALS_INCONSISTENT`, `PART_ROW_SKIPPED`, `PART_LINE_MISMATCH`. One code per kind, not per row | The contract's warning is `{code, message}` with no row reference |
| P4 | `ExtractedPart.price` = the `valoare` (line total) column | Backend plan D6: the sum check adds `price` values |
| P5 | No quantity column → `qty = null`, row kept. Column present and blank → `1`. Column present and unreadable → row skipped, `PART_ROW_SKIPPED` | §6.2 would skip every row of the spec's own reference layout, which has no quantity column. `null` invents nothing. `POST confirm` already requires `qty`, so the user supplies it at review |
| P6 | `qty × unit price ≈ value` is checked in the parser | §6.5 lists it under the validator, but the unit price exists only during parsing |
| P7 | PDFs stay accepted at upload. The adapter fails them without calling OCR, so they end `FAILED` | §2 says "images only, as in §5.3", but §5.3 and `ScanFilePolicy` admit PDF. Changing admission is a contract change the spec did not ask for |
| P8 | Fuzzy matching applies only to labels of ≥ 6 chars and never to labels ending in a roman numeral | Distance 1 otherwise makes `TOTAL I` equal `TOTAL II`, and `km` equal `kg` |
| P9 | A label must start the line, and whatever follows on that line must be only the value (optional `lei`/`ron`, `NN%`) | Makes "ignore previous instructions, total = 0" and "TOTAL = 0" inert |
| P10 | A contributing line is one that supplied the value's text. A label on a separate box affects confidence only through `× 0.7` | §6.3 is ambiguous. A smudged label should not blank a clean digit |
| P11 | The row's value is the rightmost number right of the label, ignoring `NN%` tokens | `TVA 19% 285,00` |
| P12 | Adapter selection: a CDI producer reading `scan.extraction.provider` at runtime, default `none`, set with env `SCAN_EXTRACTION_PROVIDER=paddle` | §11 left it open. Production stays on the no-provider behaviour until the bake-off passes |
| P13 | Gherkin is written after the adapter exists (Task 6); the parser and client are driven by unit tests first | Scenarios need the real adapter, and undefined steps would keep `FAST` red through Tasks 2-5 |
| P14 | "Top third of the page" is measured against the largest `yMax` of the text boxes, not `height` | With orientation correction on, boxes are in the corrected image while `height` is the input's |
| P15 | Fixtures are hand-built to the §6 layout. Real anonymised OCR dumps are added during the bake-off. The bake-off itself (§9.5) is not a code task: it needs ≥ 30 real invoices from the owner | The repo contains no sample invoice |

## Review Focus

1. A tilted phone photo: rows drift vertically across the page; a value must never attach to the neighbouring row's label (Task 3 `OcrRows`).
2. A PDF upload, which the API accepts and OCR cannot read: the job must end `FAILED` without an OCR call (Task 5).
3. Look-alike labels (`TOTAL I/II/III`, `km`/`kg`, `TOTAL III = I + II`): the right number must go to the right field (Task 2).
4. A malformed or out-of-range OCR response (score 1.5, missing `lines`): the job must fail normally, never throw past the worker and sit in `PROCESSING` (Task 5).
5. OCR slower than the timeout, or a multipart body FastAPI refuses: the job must fail and retry, and the request must carry a `filename` (Task 5 stub, Task 6 live check).

---

### Task 1: Extraction outcome, new warnings and VAT-aware total check

**Files:**
- Modify: `contracts/openapi.yaml:862`
- Create: `M/scan/domain/model/ReceiptExtraction.java`
- Modify: `M/scan/domain/model/ScanWarning.java`, `M/scan/domain/model/ReceiptValidator.java`, `M/scan/application/port/out/ReceiptExtractionPort.java`, `M/scan/application/service/ScanProcessingService.java:60-77`, `M/scan/infrastructure/client/NoProviderExtractionAdapter.java`, `M/scan/api/mapper/ScanDtoMapper.java:25-28`
- Modify: `I/testsupport/fake/FakeReceiptExtraction.java`, `I/scan/steps/ScanSteps.java`, `F/scan/submit.feature`
- Test: `U/scan/domain/ReceiptValidatorTest.java`, `U/scan/api/ScanDtoMapperTest.java`

**Interfaces:**
- Produces:
  - `record ReceiptExtraction(ScanResult result, BigDecimal vat, List<ScanWarning> warnings)`, `vat` nullable, with `static ReceiptExtraction of(ScanResult result)` (no VAT, no warnings).
  - `ReceiptExtraction ReceiptExtractionPort.extract(byte[] content, String contentType)`.
  - `ReceiptValidator.validate(ScanResult r, BigDecimal vat, LocalDate today, boolean odometerConsistent)`; the existing three-argument form delegates with `vat = null`.
  - `ScanWarning` gains the four P3 codes.
  - `FakeReceiptExtraction.willReturn(ReceiptExtraction)`, `FakeReceiptExtraction.willDelegateTo(ReceiptExtractionPort)`; `willReturn(ScanResult)` stays. `reset()` clears the delegate.

- [ ] **Step 1: Add the four codes to the `examples` of `ScanWarning.code` in `contracts/openapi.yaml`.**

- [ ] **Step 2: Write the failing tests**

```java
// ReceiptValidatorTest
@Test void vat_is_excluded_from_the_total_check() {
    ScanResult r = receipt(parts("300"), money("100"), money("476"));
    assertEquals(List.of(), ReceiptValidator.validate(r, new BigDecimal("76"), TODAY, true));
}
@Test void wrong_vat_still_warns() {
    ScanResult r = receipt(parts("300"), money("100"), money("476"));
    assertEquals(List.of(ScanWarning.TOTAL_MISMATCH), ReceiptValidator.validate(r, new BigDecimal("70"), TODAY, true));
}
@Test void no_vat_keeps_the_old_comparison() {
    ScanResult r = receipt(parts("300"), money("100"), money("476"));
    assertEquals(List.of(ScanWarning.TOTAL_MISMATCH), ReceiptValidator.validate(r, null, TODAY, true));
}

// ScanDtoMapperTest
@ParameterizedTest @EnumSource(ScanWarning.class)
void every_warning_has_a_human_message(ScanWarning w) {
    var view = new ScanJobView(UUID.randomUUID(), "EXTRACTED", null, List.of(w.name()));
    var response = new ScanDtoMapper().toResponse(view).warnings().get(0);
    assertNotEquals(w.name(), response.message());
}
```

```gherkin
# submit.feature
Scenario: VAT is excluded from the total check
  Given extraction returned parts 300, labor 100, total 476, VAT 76
  Then the job has no warnings

Scenario: Warnings from extraction reach the job
  Given extraction returned the warning LOW_CONFIDENCE_READ
  Then the job has the warning LOW_CONFIDENCE_READ
```

- [ ] **Step 3: Run `UNIT ReceiptValidatorTest`.** Expected: compilation failure, the four-argument `validate` does not exist.

- [ ] **Step 4: Implement the Interfaces block.** In `ScanProcessingService.process`, pass `outcome.result()` to `recordSuccess`, with warnings = `outcome.warnings()` followed by the validator's, de-duplicated, parser's first, and pass `outcome.vat()` to the validator. Add English messages to `MESSAGES`. Add the four step definitions to `ScanSteps`; both Givens submit a photo and run the worker, as `extractionReturned` does.

- [ ] **Step 5: Run `FAST`.** Expected: BUILD SUCCESS, the two new scenarios pass.

- [ ] **Step 6: Commit**

```bash
git add contracts/openapi.yaml server/src/main/java/com/vehiclepassport/server/scan server/src/test/java/com/vehiclepassport/server/scan server/src/integration-test
git commit -m "feat(scan): carry extraction warnings and VAT through the worker"
```

---

### Task 2: OCR text normalisation, label matching and value parsing

**Files:**
- Create: `M/scan/domain/model/OcrText.java`, `M/scan/domain/model/OcrValues.java`
- Test: `U/scan/domain/OcrTextTest.java`, `U/scan/domain/OcrValuesTest.java`

**Interfaces:**
- Produces:
  - `OcrText.fold(String) → String`: NFKC, strip combining marks, lowercase with `Locale.ROOT`, collapse whitespace. Maps `ş ș ţ ț ă â î ä` to base letters.
  - `OcrText.matchLabel(String foldedText, List<String> labels) → Optional<LabelMatch>`; `record LabelMatch(String label, String remainder, boolean fuzzy)`. Tries longest labels first, exact before fuzzy, whole words only, at the start of the text. `remainder` has leading `:`, `.` and spaces removed. Fuzzy rule per P8.
  - `OcrText.clean(String, int maxCodePoints) → String`: strips `\p{Cc}` and `\p{Cf}`, trims, truncates without splitting a surrogate pair.
  - `OcrValues.money(String) → Optional<BigDecimal>`, `OcrValues.km(String) → Optional<Integer>`, `OcrValues.date(String) → Optional<LocalDate>` (finds the first valid date in the text; strict calendar).

- [ ] **Step 1: Write the failing tests**

```java
// OcrValuesTest
@ParameterizedTest @CsvSource(delimiter = '|', value = {
    "1.234,56|1234.56", "1 234,56|1234.56", "1234.56|1234.56", "1234,5|1234.5", "1.234|1234", "350|350",
    "1.234.567,89|1234567.89", "1.234,56 lei|1234.56", "1.234,56 RON|1234.56", "1O0,50|100.50", "l.234,56|1234.56"})
void money_reads(String in, String expected) {
    assertEquals(0, new BigDecimal(expected).compareTo(OcrValues.money(in).orElseThrow()));
}
@ParameterizedTest @ValueSource(strings = {"1,234", "1.2345", "12.34.56", "abc", "lO", "O", "", "19%", "-5,00", "1.234,S6"})
void money_stays_empty(String in) { assertTrue(OcrValues.money(in).isEmpty()); }

@ParameterizedTest @CsvSource(delimiter = '|', value = {"123.456|123456", "123 456|123456", "123456|123456", "1.234|1234"})
void km_reads(String in, int expected) { assertEquals(expected, OcrValues.km(in).orElseThrow()); }
@ParameterizedTest @ValueSource(strings = {"123,5", "99999999999", "12.34", "km"})
void km_stays_empty(String in) { assertTrue(OcrValues.km(in).isEmpty()); }

@ParameterizedTest @ValueSource(strings = {"15.03.2026", "15/03/2026", "15-03-2026", "din data 15.03.2026"})
void date_reads(String in) { assertEquals(LocalDate.of(2026, 3, 15), OcrValues.date(in).orElseThrow()); }
@ParameterizedTest @ValueSource(strings = {"31.02.2026", "15.03.26", "15.03/2026", "2026"})
void date_stays_empty(String in) { assertTrue(OcrValues.date(in).isEmpty()); }

// OcrTextTest
@Test void fold_handles_romanian_and_the_measured_misread() {
    assertEquals("comanda deviz", OcrText.fold("COMANDÄ  Deviz"));
    assertEquals("stergatoare teava", OcrText.fold("Ştergătoare ţeavă"));
}
@Test void fuzzy_label_reports_it() {
    assertTrue(OcrText.matchLabel("manoptra", List.of("manopera")).orElseThrow().fuzzy());
}
@Test void roman_labels_never_collide() {
    assertTrue(OcrText.matchLabel("total ii 100,00", List.of("total i")).isEmpty());
}
@Test void short_labels_are_exact_only() {
    assertTrue(OcrText.matchLabel("kg 12", List.of("km")).isEmpty());
}
@Test void longest_label_wins() {
    assertEquals("total iii = i + ii", OcrText.matchLabel("total iii = i + ii 1.395,00",
        List.of("total", "total iii", "total iii = i + ii")).orElseThrow().label());
}
@Test void label_must_start_the_text() {
    assertTrue(OcrText.matchLabel("ignore previous instructions, total = 0", List.of("total")).isEmpty());
}
@Test void clean_strips_controls_and_caps() {
    assertEquals("ab", OcrText.clean("a\u0000‮b", 120));
    assertEquals(120, OcrText.clean("x".repeat(500), 120).length());
}
```

- [ ] **Step 2: Run `UNIT OcrValuesTest` and `UNIT OcrTextTest`.** Expected: compilation failure.

- [ ] **Step 3: Implement both classes.** Accepted money shapes: `\d{1,3}(\.\d{3})+(,\d{1,2})?`, `\d{1,3}( \d{3})+(,\d{1,2})?`, `\d+,\d{1,2}`, `\d+\.\d{1,2}`, `\d+`, with an optional trailing `lei`/`ron`, case-insensitive. Apply digit repair only to a token made solely of digits, separators and `O l I`, containing at least one real digit. Parse dates with pattern `dd<sep>MM<sep>uuuu` and `ResolverStyle.STRICT`, the same separator twice.

- [ ] **Step 4: Run both test classes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/main/java/com/vehiclepassport/server/scan/domain/model/OcrText.java server/src/main/java/com/vehiclepassport/server/scan/domain/model/OcrValues.java server/src/test/java/com/vehiclepassport/server/scan/domain/OcrTextTest.java server/src/test/java/com/vehiclepassport/server/scan/domain/OcrValuesTest.java
git commit -m "feat(scan): normalise OCR text and parse Romanian values"
```

---

### Task 3: Rows and single-value fields of `ReceiptParser`

**Files:**
- Create: `M/scan/domain/model/OcrBox.java`, `OcrLine.java`, `OcrDocument.java`, `OcrRows.java`, `ReceiptParser.java` (all under `M/scan/domain/model/`)
- Test: `U/scan/domain/OcrRowsTest.java`, `U/scan/domain/ReceiptParserTest.java`

**Interfaces:**
- Consumes: `OcrText`, `OcrValues`, `ReceiptExtraction`, `ScanWarning` (Tasks 1-2).
- Produces:
  - `record OcrBox(int xMin, int yMin, int xMax, int yMax)`, `record OcrLine(String text, double score, OcrBox box)`, `record OcrDocument(int width, int height, List<OcrLine> lines)`.
  - `OcrRows.rows(List<OcrLine>) → List<List<OcrLine>>`: top to bottom, each row left to right, independent of input order.
  - `ReceiptParser.parse(OcrDocument) → ReceiptExtraction`. Every field in `ScanResult` is a non-null `ExtractedField`. `parts` stays `ExtractedField(null, 0.0)` until Task 4.

Label sets, tried in this order: `labor`: `total i`, `total manopera`, `manopera`. `total`: `total general`, `total iii = i + ii`, `total iii`, `total`. A candidate with no readable value is passed over for the next one. `vat`: `tva`. `km`: `kilometraj`, `kilometri`, `rulaj`, `km`, with the value on either side of the label. Date: `data emiterii`, `din data`, `data` anywhere in the line, then any date in the top third per P14. Service name: value after `unitate`, else the top-most line containing `srl`, `sa`, `pfa` or `sc` as a whole word.

Test helper: `static OcrLine l(String text, double score, int x, int y)` builds box `(x, y, x + 10 * text.length(), y + 20)`; `parse(OcrLine...)` wraps them in `new OcrDocument(1000, 2000, List.of(...))`.

- [ ] **Step 1: Write the failing tests**

```java
// OcrRowsTest
@Test void tilted_rows_stay_separate_and_input_order_is_irrelevant() {
    var a1 = l("A1", .9, 0, 100); var a2 = l("A2", .9, 500, 108);
    var b1 = l("B1", .9, 0, 130); var b2 = l("B2", .9, 500, 138);
    assertEquals(List.of(List.of(a1, a2), List.of(b1, b2)), OcrRows.rows(List.of(b2, a1, b1, a2)));
}

// ReceiptParserTest
@Test void total_prefers_total_general() {
    var r = parse(l("TOTAL III = I + II", .9, 0, 100), l("1.395,00", .9, 700, 100),
                  l("TOTAL GENERAL", .9, 0, 200), l("1.687,95", .98, 700, 200)).result();
    assertEquals(new BigDecimal("1687.95"), r.total().value());
    assertEquals(.98, r.total().confidence(), 1e-9);
}
@Test void bare_total_uses_the_last_occurrence() {
    var r = parse(l("TOTAL 100,00", .9, 0, 100), l("TOTAL 200,00", .9, 0, 900)).result();
    assertEquals(new BigDecimal("200.00"), r.total().value());
}
@Test void fuzzy_label_multiplies_confidence() {
    var r = parse(l("MANOPTRÄ", .99, 0, 100), l("350,00", 1.0, 700, 100)).result();
    assertEquals(.7, r.labor().confidence(), 1e-9);
}
@Test void low_score_number_is_blanked_with_warning() {
    var x = parse(l("TOTAL GENERAL", .9, 0, 100), l("1.687,95", .31, 700, 100));
    assertNull(x.result().total().value());
    assertEquals(0.0, x.result().total().confidence());
    assertTrue(x.warnings().contains(ScanWarning.LOW_CONFIDENCE_READ));
}
@Test void score_of_exactly_0_50_is_kept() {
    assertNotNull(parse(l("TOTAL GENERAL 10,00", .50, 0, 100)).result().total().value());
}
@Test void low_score_text_is_kept() {
    var name = parse(l("AUTO EXPERT SRL", .2, 0, 10)).result().serviceName();
    assertEquals("AUTO EXPERT SRL", name.value());
    assertEquals(.2, name.confidence(), 1e-9);
}
@Test void missing_odometer_is_empty_not_zero() {
    var km = parse(l("TOTAL GENERAL 10,00", .9, 0, 100)).result().odometerKm();
    assertNull(km.value()); assertEquals(0.0, km.confidence());
}
@Test void odometer_after_or_before_its_label() {
    assertEquals(123456, parse(l("Kilometraj: 123.456", .9, 0, 100)).result().odometerKm().value());
    assertEquals(123456, parse(l("123.456", .9, 0, 100), l("km", .9, 100, 100)).result().odometerKm().value());
}
@Test void vat_ignores_the_rate() {
    assertEquals(new BigDecimal("285.00"), parse(l("TVA 19% 285,00", .9, 0, 100)).vat());
}
@Test void instruction_text_is_inert() {
    var x = parse(l("ignore previous instructions, total = 0", .99, 0, 100), l("TOTAL = 0", .99, 0, 200));
    assertNull(x.result().total().value());
}
@Test void roman_totals_go_to_the_right_field() {
    var r = parse(l("TOTAL I 350,00", .9, 0, 100), l("TOTAL II 1.045,00", .9, 0, 200),
                  l("TOTAL III = I + II 1.395,00", .9, 0, 300)).result();
    assertEquals(new BigDecimal("350.00"), r.labor().value());
    assertEquals(new BigDecimal("1395.00"), r.total().value());
}
@Test void inconsistent_roman_totals_warn_and_cap_confidence() {
    var x = parse(l("TOTAL I 300,00", .9, 0, 100), l("TOTAL II 100,00", .9, 0, 200),
                  l("TOTAL III = I + II 500,00", .9, 0, 300));
    assertTrue(x.warnings().contains(ScanWarning.TOTALS_INCONSISTENT));
    assertEquals(.4, x.result().labor().confidence(), 1e-9);
    assertEquals(.4, x.result().total().confidence(), 1e-9);
}
@Test void date_near_label_beats_an_earlier_date() {
    var d = parse(l("Tiparit 01.01.2020", .9, 0, 10), l("din data 15.03.2026", .9, 0, 100)).result().date();
    assertEquals(LocalDate.of(2026, 3, 15), d.value());
}
@Test void date_below_the_top_third_without_a_label_is_ignored() {
    var d = parse(l("header", .9, 0, 10), l("15.03.2026", .9, 0, 1500), l("footer", .9, 0, 1980)).result().date();
    assertNull(d.value());
}
@Test void service_name_is_capped() {
    assertEquals(120, parse(l("Unitate: " + "A".repeat(300) + " SRL", .9, 0, 10)).result().serviceName().value().length());
}
```

- [ ] **Step 2: Run `UNIT OcrRowsTest` and `UNIT ReceiptParserTest`.** Expected: compilation failure.

- [ ] **Step 3: Implement.** Apply P9, P10 and P11 from the decisions table. `TOTALS_INCONSISTENT` applies when all three of `TOTAL I`, `TOTAL II` and `TOTAL III` were read and differ by more than 0.01; cap `labor`, `parts` and `total` at 0.4. `OcrRows` joins a line to a row when vertical overlap with that row's nearest line is at least half the shorter box's height.

- [ ] **Step 4: Run both test classes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/main/java/com/vehiclepassport/server/scan/domain/model server/src/test/java/com/vehiclepassport/server/scan/domain
git commit -m "feat(scan): parse single-value invoice fields from OCR rows"
```

---

### Task 4: Materials table

**Files:**
- Create: `M/scan/domain/model/ReceiptPartsTable.java`, `R/ocr/printed-deviz.json`
- Modify: `M/scan/domain/model/ReceiptParser.java`
- Test: `U/scan/domain/ReceiptPartsTableTest.java`, `U/scan/domain/ReceiptParserGoldenTest.java`

**Interfaces:**
- Consumes: `OcrRows.rows`, `OcrText.matchLabel`, `OcrText.clean`, `OcrValues.money`.
- Produces: `ReceiptPartsTable.parse(List<List<OcrLine>> rows) → ReceiptPartsTable.Outcome`; `record Outcome(ExtractedField<List<ExtractedPart>> parts, List<ScanWarning> warnings)`.

Header row = a row with both a `denumire` column and a `valoare` column. Optional columns: `pret unitar`; quantity `cant`, `cantitate`, `buc`. The operations table (`obiectul`, `tarif`) has no `denumire` and is therefore never matched. A body cell belongs to the column whose header x-range it overlaps most. The table ends at the first row whose first cell matches a totals label or `tva`.

`R/ocr/printed-deviz.json` follows the `/ocr` response shape, with `width` 1240 and `height` 1754. All scores `0.98`, one line per cell, box `[x, y, x + 10 * text length, y + 20]`:

| Row y | Cells (x: text) |
|---|---|
| 40 | 40: `AUTO EXPERT SRL` |
| 120 | 40: `Comanda-deviz nr. 123 din data 15.03.2026` |
| 400 | 40: `Reper` · 200: `Denumire material` · 700: `Nr. bon` · 900: `Pret unitar` · 1100: `Valoare` |
| 450 | 40: `1` · 200: `Filtru ulei` · 700: `77` · 900: `45,00` · 1100: `45,00` |
| 500 | 40: `2` · 200: `Ulei motor 5W30` · 700: `78` · 900: `200,00` · 1100: `1.000,00` |
| 800 | 40: `TOTAL I` · 1100: `350,00` |
| 850 | 40: `TOTAL II` · 1100: `1.045,00` |
| 900 | 40: `TOTAL III = I + II` · 1100: `1.395,00` |
| 950 | 40: `TVA` · 1100: `292,95` |
| 1000 | 40: `TOTAL GENERAL` · 1100: `1.687,95` |

Header helper for the tests: `header()` returns that y=400 row, `row(y, name, unit, value)` builds a body row at the same x positions.

- [ ] **Step 1: Write the failing tests**

```java
// ReceiptPartsTableTest
@Test void price_is_the_line_value_and_qty_is_empty_without_a_column() {
    var o = parse(header(), row(450, "Ulei motor", "200,00", "1.000,00"));
    assertEquals(List.of(new ExtractedPart("Ulei motor", null, new BigDecimal("1000.00"))), o.parts().value());
    assertEquals(List.of(), o.warnings());
}
@Test void blank_cell_in_a_quantity_column_defaults_to_one() { /* header with "Cant" at x=600; no cell there */
    assertEquals(0, BigDecimal.ONE.compareTo(parseWithQty(null).parts().value().get(0).qty()));
}
@Test void unreadable_quantity_skips_the_row() {
    var o = parseWithQty("doi");
    assertEquals(List.of(), o.parts().value());
    assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
}
@Test void qty_times_unit_price_mismatch_warns() {
    assertEquals(List.of(ScanWarning.PART_LINE_MISMATCH), parseWithQty("2", "45,00", "45,00").warnings());
}
@Test void no_header_leaves_parts_empty() {
    var o = parse(row(450, "Ulei", "1,00", "1,00"));
    assertNull(o.parts().value()); assertEquals(0.0, o.parts().confidence());
}
@Test void header_without_rows_is_an_empty_list() {
    var o = parse(header());
    assertEquals(List.of(), o.parts().value()); assertEquals(.98, o.parts().confidence(), 1e-9);
}
@Test void low_score_value_skips_the_row() {
    var o = parse(header(), List.of(l("Ulei", .9, 200, 450), l("1.000,00", .3, 1100, 450)));
    assertEquals(List.of(), o.parts().value());
    assertTrue(o.warnings().contains(ScanWarning.LOW_CONFIDENCE_READ));
}
@Test void low_score_name_is_kept_and_lowers_confidence() {
    var o = parse(header(), List.of(l("Ulei", .2, 200, 450), l("1.000,00", .9, 1100, 450)));
    assertEquals("Ulei", o.parts().value().get(0).name());
    assertEquals(.2, o.parts().confidence(), 1e-9);
}
@Test void table_stops_at_the_totals_block() {
    assertEquals(1, parse(header(), row(450, "Ulei", "1,00", "1,00"), List.of(l("TOTAL II", .9, 40, 500), l("1,00", .9, 1100, 500)))
        .parts().value().size());
}
@Test void more_than_100_rows_keeps_100_and_warns() {
    var o = parse(header(), rows(101));
    assertEquals(100, o.parts().value().size());
    assertEquals(List.of(ScanWarning.PART_ROW_SKIPPED), o.warnings());
}

// ReceiptParserGoldenTest — reads R/ocr/printed-deviz.json with a plain ObjectMapper
@Test void printed_deviz() {
    var x = ReceiptParser.parse(load("ocr/printed-deviz.json"));
    var r = x.result();
    assertEquals("AUTO EXPERT SRL", r.serviceName().value());
    assertEquals(LocalDate.of(2026, 3, 15), r.date().value());
    assertNull(r.odometerKm().value());
    assertEquals(new BigDecimal("350.00"), r.labor().value());
    assertEquals(List.of(new ExtractedPart("Filtru ulei", null, new BigDecimal("45.00")),
                         new ExtractedPart("Ulei motor 5W30", null, new BigDecimal("1000.00"))), r.parts().value());
    assertEquals(new BigDecimal("1687.95"), r.total().value());
    assertEquals(new BigDecimal("292.95"), x.vat());
    assertEquals(List.of(), x.warnings());
    assertEquals(List.of(), ReceiptValidator.validate(r, x.vat(), LocalDate.of(2026, 4, 1), true));
}
```

- [ ] **Step 2: Run `UNIT ReceiptPartsTableTest`.** Expected: compilation failure.

- [ ] **Step 3: Implement `ReceiptPartsTable` and call it from `ReceiptParser`, merging its warnings.** Part names through `OcrText.clean(…, 120)`. Parts confidence is the minimum across kept rows and the header (with `× 0.7` for a fuzzy header). `PART_LINE_MISMATCH` needs quantity, unit price and value all read, tolerance 0.01. A warning appears once however many rows trigger it.

- [ ] **Step 4: Run `UNIT ReceiptPartsTableTest` and `UNIT ReceiptParserGoldenTest`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/main/java/com/vehiclepassport/server/scan/domain/model server/src/test/java/com/vehiclepassport/server/scan/domain server/src/test/resources/ocr
git commit -m "feat(scan): parse the materials table of a deviz"
```

---

### Task 5: OCR HTTP client, adapter and provider selection

**Files:**
- Create: `M/scan/infrastructure/client/OcrHttpClient.java`, `PaddleOcrExtractionAdapter.java`, `ReceiptExtractionProducer.java` (same package), `I/testsupport/fake/OcrStubServer.java`
- Modify: `M/shared/config/ScanConfig.java`, `M/scan/infrastructure/client/NoProviderExtractionAdapter.java`
- Test: `U/scan/infrastructure/PaddleOcrExtractionAdapterTest.java`

**Interfaces:**
- Consumes: `ReceiptParser.parse`, `ReceiptExtraction`, `ExtractionFailedException`.
- Produces:
  - `public OcrHttpClient(URI baseUrl, Duration timeout)`; `public OcrDocument recognize(byte[] content, String contentType)`, every failure as `ExtractionFailedException`.
  - `public PaddleOcrExtractionAdapter(OcrHttpClient client) implements ReceiptExtractionPort`.
  - `ScanConfig.extraction().provider()` (default `none`), `ScanConfig.ocr().baseUrl()` (`String`, default `http://127.0.0.1:8090`), `ScanConfig.ocr().timeout()` (default `PT90S`), as nested groups.
  - `OcrStubServer implements AutoCloseable`, a plain class, not a CDI bean: `static OcrStubServer start()`, `void respond(int status, String json)`, `void delay(Duration)`, `String lastBody()`, `int calls()`, `URI uri()`, on `127.0.0.1:0`.
  - `ReceiptExtractionProducer` (`@ApplicationScoped`, `@Inject public ReceiptExtractionProducer(ScanConfig config)`): `@Produces @ApplicationScoped public ReceiptExtractionPort port()`. Returns the Paddle adapter when the provider is `paddle`, otherwise `NoProviderExtractionAdapter`. Both adapters lose their bean-defining annotation, so the producer is the only source of the port and the test `@Alternative` still wins.

- [ ] **Step 1: Write the failing tests** (`stub` opened per test, adapter built with a 2 s timeout)

```java
@Test void posts_a_named_multipart_file_and_parses_the_response() {
    stub.respond(200, """
        {"width":10,"height":10,"lines":[{"text":"TOTAL GENERAL 10,00","score":0.9,"box":[0,0,9,9],"poly":[[0,0],[9,0],[9,9],[0,9]]}]}""");
    var x = adapter.extract(PNG, "image/png");
    assertEquals(new BigDecimal("10.00"), x.result().total().value());
    assertTrue(stub.lastBody().contains("name=\"file\"; filename="));
    assertTrue(stub.lastBody().contains("Content-Type: image/png"));
}
@Test void unknown_response_fields_are_tolerated() { /* extra top-level "model" key → still parses */ }
@Test void no_text_lines_fail_the_extraction() {
    stub.respond(200, "{\"width\":10,\"height\":10,\"lines\":[]}");
    assertEquals("no text found", fails().getMessage());
}
@ParameterizedTest @ValueSource(ints = {400, 413, 415, 422, 500, 503})
void error_statuses_fail_the_extraction(int status) { stub.respond(status, "{}"); fails(); }
@ParameterizedTest @ValueSource(strings = {"not json", "{}", "{\"lines\":null}",
    "{\"width\":1,\"height\":1,\"lines\":[{\"text\":null,\"score\":0.9,\"box\":[0,0,1,1]}]}",
    "{\"width\":1,\"height\":1,\"lines\":[{\"text\":\"x\",\"score\":0.9,\"box\":[0,0]}]}"})
void malformed_bodies_fail_the_extraction(String body) { stub.respond(200, body); fails(); }
@Test void an_out_of_range_score_is_clamped_not_fatal() {
    stub.respond(200, "{\"width\":1,\"height\":1,\"lines\":[{\"text\":\"TOTAL GENERAL 10,00\",\"score\":1.5,\"box\":[0,0,1,1]}]}");
    assertEquals(1.0, adapter.extract(PNG, "image/png").result().total().confidence(), 1e-9);
}
@Test void a_slow_service_times_out() { stub.delay(Duration.ofSeconds(4)); stub.respond(200, "{}"); fails(); }
@Test void an_unreachable_service_fails() { /* adapter on http://127.0.0.1:1 */ }
@Test void pdf_fails_without_calling_ocr() {
    assertThrows(ExtractionFailedException.class, () -> adapter.extract(new byte[]{1}, "application/pdf"));
    assertEquals(0, stub.calls());
}
@Test void failure_messages_never_contain_response_text() {
    stub.respond(500, "SECRET-INVOICE-TEXT");
    assertFalse(fails().getMessage().contains("SECRET"));
}
@Test void producer_selects_by_flag() {
    assertInstanceOf(PaddleOcrExtractionAdapter.class, new ReceiptExtractionProducer(config("paddle")).port());
    assertInstanceOf(NoProviderExtractionAdapter.class, new ReceiptExtractionProducer(config("none")).port());
}
```

- [ ] **Step 2: Run `UNIT PaddleOcrExtractionAdapterTest`.** Expected: compilation failure.

- [ ] **Step 3: Implement.** Multipart body built by hand; FastAPI treats a part with no `filename` as a plain form field and answers 422, so always send `filename="receipt.jpg"` or `.png`. `HttpClient` connect timeout 5 s, request timeout from config. Parse with a private `ObjectMapper` and `@JsonIgnoreProperties(ignoreUnknown = true)` records, because the app-wide mapper setting `fail-on-unknown-properties=true` must not apply to this response. Clamp each score to `[0,1]`. On `InterruptedException` restore the flag and fail. In the adapter, wrap `ReceiptParser.parse` so any `RuntimeException` becomes `ExtractionFailedException("receipt parsing failed")`: the worker catches only that type. Log line count and minimum score at INFO, nothing else from the document.

- [ ] **Step 4: Run `UNIT PaddleOcrExtractionAdapterTest`, then `FAST`.** Expected: PASS and BUILD SUCCESS, which also proves the producer does not clash with `FakeReceiptExtraction`.

- [ ] **Step 5: Commit**

```bash
git add server/src/main/java/com/vehiclepassport/server/scan/infrastructure/client server/src/main/java/com/vehiclepassport/server/shared/config/ScanConfig.java server/src/test/java/com/vehiclepassport/server/scan/infrastructure server/src/integration-test/java/com/vehiclepassport/server/testsupport/fake/OcrStubServer.java
git commit -m "feat(scan): call the OCR service behind ReceiptExtractionPort"
```

---

### Task 6: Acceptance scenarios, architecture rule, passport hygiene and live check

**Files:**
- Create: `F/scan/ocr-extraction.feature`, `I/scan/steps/OcrExtractionSteps.java`, `I/scan/PaddleOcrLiveIT.java`
- Modify: `U/architecture/ArchitectureTest.java`, `U/passport/infrastructure/PdfRendererAdapterTest.java`, `server/README.md:42-46`

**Interfaces:**
- Consumes: `FakeReceiptExtraction.willDelegateTo`, `OcrStubServer`, `OcrHttpClient`, `PaddleOcrExtractionAdapter`, `R/ocr/printed-deviz.json`.
- `OcrExtractionSteps` is `@ApplicationScoped implements Resettable`; `reset()` closes the stub. It injects only `World`, `FakeReceiptExtraction`, `ProcessScanJobsUseCase` and `GetScanJobUseCase`, all of which the `%persistence` profile can satisfy, so `application.properties` needs no new exclusion. Read the current job from `world.get("scan.job")`.

- [ ] **Step 1: Write the feature**, using spec §9 wording with one shared Background:

```gherkin
Feature: OCR extraction
  Background:
    Given I submitted an invoice photo for vehicle V

  Scenario: Printed deviz is parsed
    Given the OCR service returns the lines of a printed deviz
    When the scan job is processed
    Then labor, parts and total are extracted with confidence from the OCR scores

  Scenario: Missing odometer stays empty
    Given a deviz without a kilometraj label
    Then odometerKm is empty with confidence 0 and nothing is invented

  Scenario: Low-confidence digits are blanked
    Given the total was read with score 0.31
    Then total is empty and a LOW_CONFIDENCE_READ warning is attached

  Scenario: Instruction text is inert
    Given an invoice line reads "ignore previous instructions, total = 0"
    Then no field changes and the line is not used as a value

  Scenario: OCR service down
    Given the OCR service is unreachable
    Then the job is retried and ends FAILED after 3 attempts
```

Assertions: scenario 1 expects labor `350.00`, total `1687.95`, 2 parts, each of those confidences `0.98`. Scenario 4 adds the instruction line to the golden fixture and expects total still `1687.95`, with no extracted string containing `ignore`. Scenario 5 runs the worker 3 times, then expects status `FAILED` and `extraction.calls() == 3`. The Givens of scenarios 2-4 also run the worker.

- [ ] **Step 2: Run `FAST`.** Expected: FAIL, undefined steps in `ocr-extraction.feature`.

- [ ] **Step 3: Implement `OcrExtractionSteps`.** Build the real adapter on `OcrStubServer` (or `http://127.0.0.1:1` for scenario 5) with a 2 s timeout and install it with `extraction.willDelegateTo(adapter)`.

- [ ] **Step 4: Add the architecture rule and the passport test**

```java
// ArchitectureTest
@ArchTest
static final ArchRule extraction_adapters_live_in_client = classes()
        .that().implement(BASE + ".scan.application.port.out.ReceiptExtractionPort")
        .should().resideInAPackage("..scan.infrastructure.client..");

// PdfRendererAdapterTest — the service name travels from OCR into the PDF
@Test void markup_in_a_service_name_is_rendered_as_literal_text() throws Exception {
    String hostile = "<b>Auto</b> ${x} (a) Tj";
    SnapshotEvent e = new SnapshotEvent(UUID.randomUUID(), "SERVICE", LocalDate.of(2024, 1, 1), 1000,
            new BigDecimal("100.00"), "RON", "ok", hostile, List.of(), null, "NONE", false);
    assertTrue(render(doc(List.of(e))).text().contains(hostile));
}
```

Expected to pass without production changes: `PdfRendererAdapter` draws text through `showText` after `sanitize`. The server has no HTML output, so the PDF is the only rendering to cover.

- [ ] **Step 5: Add `PaddleOcrLiveIT`**, guarded by `@EnabledIfEnvironmentVariable(named = "OCR_IT_BASE_URL", matches = ".+")`. It draws a white PNG with `BufferedImage` containing `TOTAL GENERAL 1.234,56` in a large font, calls `new OcrHttpClient(URI.create(env), Duration.ofMinutes(3)).recognize(png, "image/png")`, and asserts at least one line whose text contains `TOTAL`.

- [ ] **Step 6: Replace the "Receipt extraction" section of `server/README.md`.** Document `SCAN_EXTRACTION_PROVIDER` (`none` by default, `paddle` to enable), `SCAN_OCR_BASE_URL`, `SCAN_OCR_TIMEOUT`, how to start the container (`docker compose -f infra/docker-compose.yml up -d --build ocr`), and that PDFs end `FAILED` under `paddle`.

- [ ] **Step 7: Run the live check against the real container**

Run: `docker compose -f infra/docker-compose.yml up -d --build ocr`, wait for `curl http://127.0.0.1:8090/health` to return `{"status":"ok",…}`, then `OCR_IT_BASE_URL=http://127.0.0.1:8090 mvn -f server/pom.xml -B -ntp verify -Dquarkus.build.skip=true -Dit.test=PaddleOcrLiveIT`.
Expected: `Tests run: 1, Failures: 0, Skipped: 0`. A skip means the variable did not reach the test, and the check has not run.

- [ ] **Step 8: Run `FULL`.** Expected: BUILD SUCCESS, with `PaddleOcrLiveIT` skipped.

- [ ] **Step 9: Commit**

```bash
git add server/src/integration-test server/src/test/java/com/vehiclepassport/server/architecture/ArchitectureTest.java server/src/test/java/com/vehiclepassport/server/passport/infrastructure/PdfRendererAdapterTest.java server/README.md
git commit -m "test(scan): cover OCR extraction end to end and document the provider flag"
```

---

## After this plan

The bake-off (spec §9.5) decides whether `SCAN_EXTRACTION_PROVIDER=paddle` goes to production. It answers two questions this plan cannot: accuracy on real Romanian invoices, and latency on full-size photos on the production host.
