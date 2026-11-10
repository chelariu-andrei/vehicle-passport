# Research: OCR / AI extraction provider for `ReceiptExtractionPort`

Date: 2026-11-09. All URLs accessed 2026-11-09 unless stated. Context: spec `docs/superpowers/specs/2026-11-08-backend-design.md` section 5.3 and section 9 leave the provider open. No research/notes convention existed in `docs/` (only `superpowers/specs`, `superpowers/plans`, `diagrams`), so this file creates `docs/research/`.

Conventions: "UNVERIFIED" = I could not confirm it from a primary source in this session. Prices are USD, list price, no tax. Nothing here is benchmarked on Romanian car-service invoices (see Benchmarks).

## TL;DR

1. Use a **cloud multimodal LLM with JSON-schema output** (image in, JSON out) behind `ReceiptExtractionPort`; classic OCR alone cannot give you `parts[]`/`labor`/`total` without a second parsing stage.
2. Pick the vendor/region for **EU processing**: Anthropic's own API offers only `us` / `global` inference (no EU). Claude is EU-capable via Vertex AI `eu` or Bedrock EU profiles; Gemini via Vertex AI `eu`; OpenAI via `eu.api.openai.com` (needs ZDR/MAM approval).
3. Primary: **Gemini Flash-class on Vertex AI (`eu` endpoint)**. Fallback: **Claude (Haiku 5.5 / Sonnet 5.5) via Vertex AI EU or Bedrock EU**. Privacy-max alternative: self-hosted PaddleOCR-VL (not worth the ops at this volume).
4. Cost is negligible: roughly 1-80 USD/month at 1k-5k invoices across LLM options. Choose on accuracy, not price. Decide with a 30-invoice bake-off (below).
5. Skip hybrid OCR+LLM in v1; your domain validation (sum, monotonic km) is the cheap confidence signal.

## Comparison table

| Option | Type | Romanian | Image -> your JSON schema | Native per-field confidence | EU processing | Est. cost/1k invoices | Ops |
|---|---|---|---|---|---|---|---|
| Gemini Flash / Flash-Lite (Vertex `eu`) | cloud LLM | not stated explicitly (UNVERIFIED) | yes (structured output, UNVERIFIED in this session) | no (logprobs/self-report/consensus) | yes, `eu` multi-region | ~3-12 USD | none |
| Claude Haiku/Sonnet 5.5 (Vertex EU / Bedrock EU) | cloud LLM | not stated explicitly (UNVERIFIED) | yes, `output_config.format` json_schema | no | yes via Vertex/Bedrock; not via direct API | ~1-16 USD | none |
| OpenAI GPT-6 Luna / 6.1 Terra (`eu.api`) | cloud LLM | UNVERIFIED | yes (UNVERIFIED here) | logprobs (UNVERIFIED) | yes, but requires ZDR/MAM etc. | ~1-8 USD | none |
| Azure Document Intelligence prebuilt-invoice | cloud doc-AI | **yes** (`ro`, `RON` listed) | fixed invoice schema, not yours | field confidence (UNVERIFIED in fetched docs) | UNVERIFIED | UNVERIFIED (price not retrievable) | none |
| Google Document AI Invoice Parser | cloud doc-AI | **yes** (`ro` listed); Expense Parser **no** | fixed schema | UNVERIFIED | yes (`eu`) | UNVERIFIED (price not retrievable) | none |
| AWS Textract AnalyzeExpense | cloud doc-AI | **no evidence**: doc says non-Forms/other APIs "limited to English" | fixed schema | UNVERIFIED | UNVERIFIED | 10 USD | none |
| Mistral OCR 4.1 (+annotations) | cloud OCR+schema | UNVERIFIED | yes (annotations) | no | UNVERIFIED | 5 USD | none |
| PaddleOCR / PP-OCRv5 (+ own parser) | OSS OCR | **yes** (Latin model lists Romanian) | no, text only | per-line recognition score | self-host | GPU/VM fixed | high (Python sidecar) |
| PaddleOCR-VL 1.6 | OSS VLM | not stated (UNVERIFIED) | parsing to Markdown/JSON, not schema KIE | n/a | self-host | GPU/VM fixed | high |
| Tesseract 5 | OSS OCR | likely (UNVERIFIED) | no | per-word | self-host | CPU only | medium |
| Qwen3-VL-8B | OSS VLM | not named | prompt-driven, JSON not documented | no | self-host | GPU fixed | high |

## Per-option notes

### 1. Open-source OCR

**PaddleOCR.** Apache-2.0; latest release 3.7.0 (2026-06-11), newest item HPD-Parsing (2026-07-22) (https://github.com/PaddlePaddle/PaddleOCR). README claims PP-OCRv5 multilingual covers 109 languages and PP-OCRv6 unifies 50 languages incl. 46 Latin-script (same source; Romanian not named there). The PP-OCRv5 Latin recognition model explicitly lists Romanian; the page gives 84.7% on its own 3,111-line Latin test set and no Romanian-specific figure (https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.md). PP-StructureV3 turns images/PDFs into Markdown/JSON with table-cell coordinates (README). It returns layout + text, **not** your `{serviceName, parts[], labor, total}`; you still need a rule/LLM parser. JVM story: no Java SDK found; deployment docs expose HTTP services (Docker, vLLM backend, port 8118 VLM server, port 8080 parsing API; ~13 GB image; vLLM/FastDeploy not native on Windows), so Java would call REST (search result summary of https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html; request schema of `/layout-parsing` NOT verified).

**Tesseract.** Apache-2.0, LSTM engine, 100+ languages; Romanian availability and handwriting not stated on the repo page (https://github.com/tesseract-ocr/tesseract). Generally weaker on phone photos without heavy preprocessing (UNVERIFIED, general knowledge). Only useful as a cheap text layer.

**docTR / Surya / EasyOCR:** not researched in depth (UNVERIFIED). No reason found to prefer them over PaddleOCR for this use case.

### 2. Open-source vision-language models

- **PaddleOCR-VL-1.6**: ~0.9-1.0B params, Apache-2.0, 96.33% on OmniDocBench v1.6, Real5-OmniDocBench 93.19 (scanning 94.74, warping 92.48); no VRAM figure given; Romanian not mentioned; model card does not describe schema-based key-value extraction, only parsing to Markdown/JSON (https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6). It is a document *parser*, so you would still add a schema/LLM step.
- **Qwen3-VL-8B-Instruct**: Apache-2.0, ~9B params BF16, "supports 32 languages" for OCR (Romanian not named), no VRAM guidance, JSON output not documented (https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct). Serving via vLLM/SGLang. Needs a GPU; sizing UNVERIFIED.
- **olmOCR, Donut-style**: not researched (UNVERIFIED). Donut-style models need fine-tuning on labeled invoices, which you do not have.
- Self-hosting verdict: only worthwhile if invoices must never leave your infrastructure. Always-on GPU for <5k docs/month is poor value; ops burden (model serving, upgrades, GPU drivers) is high.

### 3. Cloud document AI

- **Azure Document Intelligence**: `prebuilt-invoice` lists Romanian (`ro`) and `RON` (v3.1 and v4.0); `prebuilt-receipt` thermal list includes Romanian (https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/prebuilt). Accepts JPEG/PNG/BMP/TIFF/HEIF, min text height 12 px on 1024x768, receipts "printed and handwritten" (https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt). F0 free tier: 500 pages/month (https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/). **Paid price per 1,000 pages: UNVERIFIED** (page rendered placeholders). EU region availability, retention: UNVERIFIED. Caveat: fixed invoice schema is built for supplier invoices; a workshop invoice's parts/labor split may not map cleanly (UNVERIFIED, test it).
- **Google Document AI**: Invoice Parser lists Romanian and regions incl. `eu`; Expense Parser does not list Romanian (DE, EN, ES, FR, JA, NL; v1.4 adds IT, PT) (https://docs.cloud.google.com/document-ai/docs/processors-list). Per-page price: UNVERIFIED (page not retrievable).
- **AWS Textract**: AnalyzeExpense $0.01/page for first 1M pages, free tier 100 pages/month, price quoted for US West (Oregon) (https://aws.amazon.com/textract/pricing/). Language doc: Romanian is among 40+ languages for text detection/tables, but Forms limited to EN/ES/IT/PT/FR/DE and "all other APIs are limited to English"; handwriting English only (https://docs.aws.amazon.com/textract/latest/dg/limits-document.html). Reading that table, AnalyzeExpense on Romanian is **not supported** (my inference; confirm). Min text height 15 px, rotation supported.

### 4. Cloud multimodal LLMs

**Anthropic Claude**
- Pricing per MTok: Haiku 5.5 $0.10 in / $0.50 out (prompts <=100k tokens); Sonnet 5.5 $2 / $10; Sonnet 5 $2 / $10; Opus 5.5 $4 / $20; Batch API = 50% off (https://platform.claude.com/docs/en/about-claude/pricing).
- Vision: 28x28 px patches; high-res tier (Claude 4.7+) max long edge 2,576 px / 4,784 tokens; e.g. 1000x1000 = 1,296 tokens, 2000x1500 = 3,888 tokens. Docs warn of hallucination/mistakes on "low-quality, rotated, or very small images" and JPEG compression artifacts (https://platform.claude.com/docs/en/build-with-claude/vision). Pre-rotate/deskew and cap size client-side.
- Structured output: GA, `output_config.format` type `json_schema`; no numeric `minimum`/`maximum`, no string length constraints; Java SDK maps a class to schema via `outputConfig(Class)`; refusals/`max_tokens` can yield invalid output (https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Pass numbers as number, confidence validated in your code.
- Privacy: commercial/API data not used for training by default (https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training). Default API retention period: UNVERIFIED (docs defer to the commercial retention policy). ZDR is available as an arrangement (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
- **EU residency**: first-party `inference_geo` supports only `"us"` and `"global"`; workspace geo only `"us"` (https://platform.claude.com/docs/en/manage-claude/data-residency). So direct Anthropic API cannot guarantee EU processing. Claude models (Haiku 4.5-5.5, Sonnet 4.5-5.5, Opus 4.5-5) are listed for Vertex AI `eu` multi-region (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency); Bedrock has geographic EU inference profiles with standard pricing (https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html). Which Claude models are in the Bedrock EU profile: UNVERIFIED. Vertex/Bedrock prices may differ from the table above (UNVERIFIED).

**Google Gemini**
- Gemini API paid tier (per 1M tokens, text/image input / output): 3.5 Flash-Lite $0.30 / $2.50; 3.1 Flash-Lite $0.25 / $1.50; 3.8 Flash and 3.6 Flash $0.75 / $3.75 through 2026-12-31 then $1.50 / $7.50; 3.1 Pro Preview $2 / $12; Batch = 50%; paid-tier data not used to improve products (https://aistudio.google.com/docs/pricing).
- Gemini API terms: prompts not used to improve products; abuse-monitoring logs kept for an unspecified period; **no regional-processing commitment** in the Gemini API terms; EEA-facing apps must use paid services (https://aistudio.google.com/docs/terms).
- EU: Vertex AI (renamed "Gemini Enterprise Agent Platform" on the page) `eu` multi-region endpoint keeps ML processing in EU member states; lists Gemini 2.5-4 incl. Flash and Flash-Lite (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency). Use Vertex `eu`, not the plain Gemini API, for the GDPR story. Vertex pricing vs. table above: UNVERIFIED.

**OpenAI**
- Per 1M tokens: gpt-6-luna $0.10 / $0.50; gpt-6.1-terra $1 / $5; gpt-6.1-sol $2 / $10; gpt-5.4-nano $0.20 / $1.25; Batch = 50% (https://developers.openai.com/api/docs/pricing). Image token cost per photo: UNVERIFIED.
- API data not used for training by default; abuse logs up to 30 days; ZDR requires approval. Europe residency per project via `eu.api.openai.com`, requires MAM/ZDR/Private Retention/Safety Retention, +10% for models released on/after 2026-03-05; `/v1/responses` and chat completions supported in EU (https://developers.openai.com/api/docs/guides/your-data).

**Mistral OCR 4.1** (secondary): $4/1k pages, $5/1k annotated pages (structured), batch 50%; OCR 4 can be self-hosted; EU hosting of the API not confirmed (https://docs.mistral.ai/inference/pricing via search summary; not directly fetched). It appears in the Vertex AI `eu` list as "Mistral OCR (25.05)" (Vertex data-residency URL above).

### Per-field confidence from LLMs

LLMs give no calibrated confidence. Options, cheapest first (all are engineering suggestions, not vendor claims):
1. Deterministic checks as confidence: sum(parts)+labor == total, date plausible, km monotonic. Already in spec. A failing check lowers the affected field's score.
2. Ask the model to also return `evidence` (verbatim text snippet per field) and `legible: bool`; down-weight fields without evidence.
3. Run 2 extractions (different model, or same model with different temperature/prompt) and score by agreement. Doubles cost (still tiny).
4. Token logprobs where the API exposes them (Gemini/OpenAI: UNVERIFIED; Anthropic: no logprobs documented in pages read, UNVERIFIED).
5. Hybrid: OCR text layer (PaddleOCR) and check the extracted value appears in it; OCR line scores give a second signal.
Azure/Google doc-AI return field-level confidence natively (UNVERIFIED in the pages fetched here).

## Benchmarks (verifiable only)

- **No published benchmark exists, that I found, for Romanian car-service invoices from phone photos.** Treat all vendor claims as non-transferable until you run your own test.
- PaddleOCR-VL-1.6: OmniDocBench v1.6 96.33%, Real5-OmniDocBench 93.19 (model card above). These are document-parsing benchmarks, not KIE on receipts.
- A search surfaced receipt KIE papers (CORD/SROIE, e.g. BLOCKIE, ACL 2025, https://aclanthology.org/2025.acl-long.844.pdf; UNIKIE-BENCH, https://arxiv.org/pdf/2602.07038; OCRBench "Hidden Mystery of OCR", https://arxiv.org/html/2305.07895v5) but I did not read their result tables; their numbers are **UNVERIFIED here** and CORD/SROIE are English/Indonesian receipts, not Romanian invoices. Do not rely on them.
- Qwen3-VL-8B card reports ParseBench mean 46.8 (text content 89.5) (card above): not receipt KIE.

## Cost table

Assumptions (mine, not vendor-stated): one JPEG per invoice; ~4,000 input tokens (image ~3,000 + prompt/schema ~1,000) and ~800 output tokens (JSON + evidence). Token counts per image on non-Claude vendors are UNVERIFIED. List prices above, global/standard routing, no caching, no batch, no retries. Batch halves LLM cost but is async (fine for your async scan jobs). Claude US-only/other residency multiplier: 1.1x on first-party; Vertex/Bedrock EU pricing UNVERIFIED, expect it to differ.

| Option | USD / invoice | 1k / month | 5k / month |
|---|---|---|---|
| Claude Haiku 5.5 | 0.0008 | 0.80 | 4 |
| Claude Sonnet 5.5 | 0.016 | 16 | 80 |
| Gemini 3.5 Flash-Lite | 0.0032 | 3.2 | 16 |
| Gemini 3.8 Flash (to 2026-12-31) | 0.006 | 6 | 30 |
| Gemini 3.8 Flash (from 2027) | 0.012 | 12 | 60 |
| OpenAI gpt-6-luna | 0.0008 | 0.8 | 4 |
| OpenAI gpt-6.1-terra | 0.008 | 8 | 40 |
| Textract AnalyzeExpense | 0.01 | 10 | 50 (but see Romanian caveat) |
| Mistral OCR 4.1 annotated | 0.005 | 5 | 25 |
| Azure DI / Google DocAI | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Self-hosted PaddleOCR-VL / Qwen3-VL | n/a | fixed GPU VM bill (UNVERIFIED) | same |

Cost is irrelevant compared to engineering time: even Sonnet at 5k/month is ~80 USD.

## Java integration

- All cloud LLMs: one outbound adapter in `scan/infrastructure/client/` implementing `ReceiptExtractionPort`; DTO of the JSON schema stays in infrastructure and is mapped to the domain `ScanResult`. Anthropic has an official Java SDK with typed structured outputs (structured-outputs page above); Gemini/OpenAI can be plain HTTP via the JDK `HttpClient` or Quarkus REST Client (their Java SDK status: UNVERIFIED).
- Keep the provider name, model id and region in `@ConfigMapping`; the port stays provider-agnostic, enabling a second adapter for the bake-off/fallback.
- Pre-process before sending: strip EXIF (GPS, device), downscale (Claude caps long edge at 2,576 px), auto-rotate. Avoid repeated lossy JPEG passes (vision doc).
- Self-hosted OCR: Python sidecar + REST; JVM calls it. Extra container, GPU, model upgrades.
- Privacy: invoices contain names, plates, addresses. Mitigate by (a) EU endpoint, (b) ZDR/no-training contract terms, (c) a prompt that returns only the five fields (never owner name/address), (d) schema without such fields, (e) delete the stored image after confirm if the spec allows. Sign the provider DPA; check subprocessors (UNVERIFIED; legal review recommended).

## Ranked shortlist

1. **Gemini Flash / Flash-Lite on Vertex AI `eu`**: lowest cost per accuracy tier I can document, EU processing documented, structured output. Weakness: Romanian handwriting/diacritic accuracy unproven.
2. **Claude Haiku 5.5 / Sonnet 5.5 via Vertex AI EU or Bedrock EU** (not the direct API for EU): documented schema-guaranteed output, official Java SDK, strong vision docs. Weakness: no native confidence/logprobs; EU only through hyperscaler.
3. **Azure Document Intelligence prebuilt-invoice** (Romanian explicitly supported): safest if LLM bake-off disappoints; needs price/region verification and a check that labor/parts fit.
4. Self-hosted PaddleOCR (+ LLM/rules parser): only if data may never leave your infra.

Primary = #1, fallback = #2 (or #3 if per-field native confidence matters more than schema flexibility). Final choice is gated on the bake-off.

## Hybrid (OCR + LLM): worth it?

Not for v1. It adds a second system (OCR sidecar) to gain a cross-check signal you can partly get from domain validation and a second LLM pass. Revisit if the bake-off shows frequent wrong digits (km, totals) that arithmetic checks do not catch; then add OCR text only as a verifier ("does this value appear in the OCR text"), not as the extractor.

## Risks

- Quality on Romanian diacritics, thermal fade, crumpled/glare photos and handwritten km is **unproven** for every option.
- LLM hallucination: plausible but wrong numbers (vision doc warns on low-quality/rotated images). Mitigate with validation + mandatory owner confirm (already in the flow).
- Model churn: model ids and prices change quickly (this page shows models up to Sonnet 5.5 / Gemini 3.8); pin model ids in config and re-run the test set on change.
- EU residency: Anthropic direct API cannot do it; Gemini API (non-Vertex) makes no regional commitment; OpenAI needs approval for EU. Wrong endpoint = silent GDPR gap.
- Vendor lock: mitigated by the port plus golden test set.
- Prompt injection from text in invoices: output is schema-constrained and human-confirmed; still never feed extracted text into other prompts/tools.

## Validation plan (about one day, a few euro)

1. Collect 30 real invoices (stratified: 15 clean print, 8 thermal/faded, 4 skewed/glare, 3 handwritten km). Hand-label ground truth for the 6 fields. Scrub or get consent for personal data.
2. Run candidates 1-3 (plus optionally PaddleOCR text as a baseline) using the same prompt/schema.
3. Metrics per field and per provider: exact-match (date, km, total), string similarity (serviceName; normalize diacritics), line-item F1 for parts (name fuzzy match + qty + price), labor/total absolute error. Also: sum-check pass rate, % invoices fully correct with zero edits, hallucination rate (value not present on the invoice), p95 latency, cost per invoice.
4. Confidence calibration: for each candidate confidence method, plot accuracy vs. confidence bucket; pick a threshold for "highlight for review". Measure how often the sum/km validation catches a wrong value.
5. Decision rule (suggested): >= 90% of invoices with total + date + km exact, <5% hallucinated fields; choose cheapest passing candidate; keep the second as fallback adapter.
6. Re-run on any model or prompt change (regression set in `src/test`).

## Open questions

- Must original images be retained after confirm? (affects storage privacy and GDPR retention.)
- Is a US/global-routed LLM acceptable if only the 5 fields and image are sent? (Needs a legal view; the safe path is EU endpoints with DPA.)
- Budget for a hyperscaler account (Vertex or Bedrock) vs. simple API key? Direct Anthropic cannot do EU.
- Do you want per-line-item confidence or only per top-level field?
- Are invoices ever multi-page or PDF-converted later? (Spec says image/PDF; this research assumed images only.)
- Verify before committing: Azure DI and Google DocAI per-page prices and EU region support; Gemini/OpenAI Java client options; Vertex/Bedrock EU model availability and pricing for the chosen Claude/Gemini model.

## Sources (primary)

- https://github.com/PaddlePaddle/PaddleOCR
- https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.md
- https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6
- https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct
- https://github.com/tesseract-ocr/tesseract
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/vision
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/manage-claude/data-residency
- https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- https://aistudio.google.com/docs/pricing
- https://aistudio.google.com/docs/terms
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency
- https://docs.cloud.google.com/document-ai/docs/processors-list
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/your-data
- https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/prebuilt
- https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt
- https://aws.amazon.com/textract/pricing/
- https://docs.aws.amazon.com/textract/latest/dg/limits-document.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html
- https://docs.mistral.ai/inference/pricing (via search summary only)
