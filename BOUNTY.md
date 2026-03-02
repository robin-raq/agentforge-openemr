# AgentForge Bounty: Discharge Workflow Agent for OpenEMR

## Customer

**Who:** Hospital discharge coordinators and hospitalist physicians at small to mid-size hospitals using OpenEMR.

**Pain:** Discharge is the most documentation-heavy moment in a hospital stay. Physicians spend 30 to 60 minutes per patient writing discharge summaries, reconciling medications, and preparing patient-facing instructions. Errors during this process (missed medication changes, unclear follow-up instructions, undocumented drug interactions) are a leading cause of hospital readmissions. OpenEMR has no built-in AI tooling to assist with this workflow.

**Why OpenEMR:** OpenEMR is the most widely used open-source EHR, serving clinics and hospitals in over 100 countries. It exposes a FHIR R4 API for patient data but lacks any AI-assisted clinical workflow features. This agent fills that gap.

## Features

### 5 Bounty Tools

| Tool | Purpose | Zod Schema Inputs | Structured Output |
|------|---------|-------------------|-------------------|
| `get_encounter_data` | Retrieve hospital encounter and admission details | `patient_id: z.string()` | JSON: encounters array with diagnoses, procedures, hospital course, admission medications |
| `reconcile_medications` | Compare admission vs discharge medications, flag changes | `patient_id, encounter_id: z.string()` | JSON: categorized medications (continued, modified, discontinued, new) with reasons |
| `draft_discharge_summary` | Generate comprehensive clinician-facing discharge summary | `patient_id, encounter_id: z.string()` | JSON: structured summary with demographics, hospital course, med changes, labs, follow-up |
| `generate_discharge_instructions` | Generate patient-friendly instructions with DailyMed drug education | `patient_id, encounter_id: z.string()` | JSON: plain-language instructions, drug education, warning signs, scheduled appointments |
| `save_to_chart` | Save a drafted document to the patient's chart | `patient_id, encounter_id, document_type, content: z.string()` | JSON: document ID, status ("draft"), timestamp |

All tools use `@langchain/core/tools` `tool()` function with Zod input schemas and return `JSON.stringify()` structured output. The agent selects tools autonomously based on the clinical query and chains them when multi-step workflows are needed (e.g., discharge summary requires `get_encounter_data` → `draft_discharge_summary` → `save_to_chart`).

### Editable Discharge Drafts

AI never writes directly to the chart. All documents are saved as "draft" and require explicit clinician approval via the "Finalize & Save to Chart" button in the UI. This draft-then-confirm pattern ensures clinician oversight on every AI-generated document.

### Scheduled Follow-Up Appointments

Discharge instructions include actual scheduled follow-up appointments with provider name, specialty, date, time, and location pulled from patient data, replacing generic "follow up in 2 weeks" guidance.

## Data Source: DailyMed (NLM/NIH)

**What:** [DailyMed](https://dailymed.nlm.nih.gov/dailymed/) is the National Library of Medicine's repository of FDA-approved drug labeling data (Structured Product Labeling / SPL). It is the authoritative source for drug information in the United States.

**Why it's relevant:** Discharge instructions need accurate drug education (what a medication does, side effects, warnings). Rather than relying on LLM knowledge (which may hallucinate), we fetch FDA-approved labeling directly from DailyMed.

**API:** `https://dailymed.nlm.nih.gov/dailymed/services/v2/`

**Client:** `src/data/dailymed-client.ts`
- `searchDrug(drugName)` — searches DailyMed for a drug by name, returns matching SPL set IDs
- `getDrugLabel(setid)` — fetches full SPL XML and parses key sections
- `getDrugEducation(drugName)` — high-level convenience method: search + parse in one call
- `parseSplSections(xml)` — extracts sections by LOINC code from SPL XML

**Sections extracted** (by LOINC code):

| Section | LOINC Code |
|---------|-----------|
| Indications & Usage | 34067-9 |
| Adverse Reactions | 34084-4 |
| Warnings & Precautions | 43685-7 |
| Dosage & Administration | 34068-7 |
| Contraindications | 34070-3 |
| Drug Interactions | 34073-7 |
| Patient Counseling | 34076-0 |
| Boxed Warning | 34066-1 |

**Error handling:** If DailyMed is unavailable or a drug is not found, the tool gracefully degrades by returning instructions without drug education rather than failing. The DailyMed client includes response caching (5-minute TTL) to reduce API calls and handle transient failures.

## Agent Access via Open Source Project's API

The agent accesses patient data through OpenEMR's FHIR R4 API:

| FHIR Resource | Use |
|---------------|-----|
| `Patient` | Demographics, conditions, allergies |
| `MedicationRequest` | Active medications, admission medications for reconciliation |
| `Observation` | Lab results, vital signs |
| `Encounter` | Hospital encounters, diagnoses, procedures |
| `AllergyIntolerance` | Allergy data for cross-reactivity checks |
| `DocumentReference` | Document CRUD (discharge summaries, instructions) |

**OAuth2 authentication:** The agent authenticates to OpenEMR's FHIR API using OAuth2 password grant with scopes including `user/Encounter.read`, `user/DocumentReference.read`, and `user/DocumentReference.write`.

**Mock data fallback:** For development and testing, a `MockDataSource` provides 4 patients with realistic clinical scenarios. The `DATA_SOURCE` env var switches between `mock` and `fhir`. Setup is documented in the [README](README.md#fhir-data-source-openemr-docker).

## Stateful CRUD Operations

The agent stores stateful data (clinical documents) tied to the DailyMed and encounter data sources, with full CRUD operations:

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| **Create** | `saveDocument()` | `POST /api/chat` (via agent tool) | Agent saves drafted document as "draft" status |
| **Read** | `getDocument()` | `GET /api/documents/:id` | Retrieve a document by ID |
| **Update** | `updateDocument()` | `POST /api/documents/:id/finalize` | Clinician finalizes draft, status changes to "final" |
| **Delete** | `deleteDocument()` | `DELETE /api/documents/:id` | Remove a draft document (finalized docs cannot be deleted) |

Document types stored: `discharge_summary`, `medication_reconciliation`, `discharge_instructions`

## Conversation History

The agent maintains conversation history across turns using server-side session management. Each session stores the full message history (user and assistant messages), enabling multi-turn clinical workflows:

```
Turn 1: "What medications is patient 4 on?"
  -> Agent calls get_medications, returns structured list

Turn 2: "Now draft a discharge summary"
  -> Agent retains context of patient 4, calls get_encounter_data + draft_discharge_summary

Turn 3: "Save that to the chart"
  -> Agent uses the draft from turn 2, calls save_to_chart
```

Sessions persist across page reloads via the chat history sidebar with patient filtering and resume capabilities.

## Verification & Safety

The verification layer scans every response for safety signals:

- `reconcile_medications` triggers alerts for modified, new, and discontinued medications
- `draft_discharge_summary` flags critical lab values at discharge (e.g., INR 3.8, K+ 5.3)
- `generate_discharge_instructions` flags new medications, dose changes, and stopped medications for patient awareness
- `save_to_chart` generates a confirmation alert showing the draft was saved
- Drug interaction severity gating prevents critical interactions from being buried

## Observability

Every agent request is traced with [Langfuse](https://langfuse.com/) for production monitoring:

- Per-request spans with tool calls, latency, and token usage
- Session grouping for multi-turn conversation tracing
- Feedback correlation (thumbs up/down linked to traces)
- Confidence scoring (0.0 to 1.0) based on tool success, source citations, safety signals
- Real-time observability sidebar in the UI showing execution traces, per-tool latency, aggregate stats, and export

## Evals

The agent is evaluated with **125 test cases** across **28 categories** at an **87.2% pass rate** (109/125).

Bounty-specific eval categories all pass at 100%:

| Category | Passed | Total |
|----------|--------|-------|
| Bounty: Encounters | 3 | 3 |
| Bounty: Discharge | 2 | 2 |
| Bounty: Workflows | 2 | 2 |
| Bounty: Edge Cases | 1 | 1 |
| Bounty: Safety | 2 | 2 |
| Bounty: Discharge Instructions | 4 | 4 |

Each eval case validates correctness (`must_contain`), safety (`must_not_contain`), and tool selection (`expected_tools`). See [evals.md](evals.md) for the full evaluation framework documentation.

## Impact

- **Time saved**: A discharge summary that takes 30 to 60 minutes to write manually can be drafted in seconds
- **Patient understanding**: Discharge instructions in plain language with FDA-sourced drug education help patients understand their care plan and reduce confusion
- **Safety improved**: Automated medication reconciliation catches changes that manual review might miss; verification layer flags critical lab values and drug interactions
- **Clinician trust**: Draft-then-confirm pattern means AI assists but never makes clinical decisions autonomously
- **Integrated**: Works within the OpenEMR workflow via FHIR R4 API, with DailyMed as an authoritative external data source

## End-to-End Workflows

**Clinician Workflow: Discharge Summary**
```
Clinician: "Draft a discharge summary for patient 4"

Agent calls get_encounter_data(patient_id: "4")
  -> Finds active encounter enc-401 (Hypertensive Emergency + AKI)

Agent calls draft_discharge_summary(patient_id: "4", encounter_id: "enc-401")
  -> Gathers demographics, hospital course, med changes, labs, vitals

Agent calls save_to_chart(patient_id: "4", encounter_id: "enc-401", ...)
  -> Saves draft document, returns Document ID: doc-1

Verification layer flags:
  - CRITICAL LAB AT DISCHARGE: INR 3.8, K+ 5.3, Creatinine 1.8
  - MEDICATION CHANGE: Lisinopril increased, Insulin Glargine added
  - DISCONTINUED: Metformin (renal function decline)

UI shows: discharge summary + safety alerts + "Finalize & Save to Chart" button

Clinician reviews, clicks Finalize
  -> POST /api/documents/doc-1/finalize -> status: "final"
```

**Patient Workflow: Discharge Instructions**
```
Clinician: "Generate discharge instructions for patient 1"

Agent calls get_encounter_data(patient_id: "1")
  -> Finds encounter enc-101

Agent calls generate_discharge_instructions(patient_id: "1", encounter_id: "enc-101")
  -> Fetches DailyMed drug education for new/modified meds
  -> Categorizes medications (new, modified, continued, discontinued)
  -> Includes scheduled follow-up appointments with provider details
  -> Builds warning signs and follow-up guidance from patient conditions

Verification layer flags:
  - NEW MEDICATION FOR PATIENT: Metoprolol 25mg twice daily
  - MEDICATION DOSE CHANGED: Lisinopril from 10mg to 20mg

Agent presents plain-language instructions the patient can understand
```

## Technical Stats

- **484 unit tests** passing (TDD throughout, including DailyMed client + discharge instructions tests)
- **125 eval cases** across 28 categories at 87.2% pass rate
- **10 tools** total (5 original + 5 bounty)
- **3 server endpoints** for document CRUD
- **2 data sources**: OpenEMR (FHIR R4) + DailyMed (NLM/NIH REST API)
- **SSE streaming** for progressive response rendering
- **Langfuse tracing** for production observability

## Open Source Contributions

- [`agentforge-clinical-agent`](https://www.npmjs.com/package/agentforge-clinical-agent) — published npm package, reusable with mock or FHIR data sources
- [clinical-agent-eval-dataset](https://github.com/robin-raq/clinical-agent-eval-dataset) — 125-case eval dataset usable as a benchmark for clinical AI agents

## Files Changed

| File | Change |
|------|--------|
| `src/data/datasource.ts` | +3 interfaces, +6 DataSource methods, +discharge_instructions type |
| `src/data/dailymed-client.ts` | NEW — DailyMed API client (search, label fetch, SPL parsing) |
| `src/data/mock-data.json` | +encounters, +admission_medications, +appointments |
| `src/data/mock-datasource.ts` | +6 method implementations |
| `src/tools/get-encounter-data.ts` | NEW |
| `src/tools/reconcile-medications.ts` | NEW |
| `src/tools/draft-discharge-summary.ts` | NEW |
| `src/tools/generate-discharge-instructions.ts` | NEW — with DailyMed integration + scheduled appointments |
| `src/tools/save-to-chart.ts` | NEW — document CRUD with draft/finalize workflow |
| `src/verification/verification.ts` | +med rec, discharge, discharge instructions, save alerts, DailyMed source |
| `src/agent.ts` | +5 tools, updated system prompt with anti-hallucination rules |
| `src/server.ts` | +finalize, get, delete document endpoints, SSE streaming |
| `public/index.html`, `public/js/chat.js`, `public/css/chat.css` | +quick prompts, tool badges, finalize button, observability sidebar, chat history |
| `src/data/fhir-datasource.ts` | +Encounter, DocumentReference, admission meds |
| `src/data/fhir-mappers.ts` | +mapFhirEncounters, mapFhirAdmissionMedications |
| `src/data/fhir-auth.ts` | +FHIR_SCOPES with Encounter + DocumentReference |
| `tests/data/dailymed-client.test.ts` | NEW — 11 tests (7 unit + 4 integration) |
| `tests/tools/generate-discharge-instructions.test.ts` | NEW — 15 tests |
| `eval/test-cases.json` | 125 eval cases (golden sets, bounty tools, adversarial, edge, workflows) |
