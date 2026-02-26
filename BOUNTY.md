# AgentForge Bounty: Discharge Summary & Medication Reconciliation

## Customer Problem

A doctor told us: hospital courses are extremely long, discharge summaries are tedious to write, and medication reconciliation at discharge is error-prone. AI integrated into the EMR for these tasks would be "awesome" -- but current tools can't be used because they aren't HIPAA-compliant. Our **draft-then-confirm** pattern solves this: AI drafts, clinician reviews and approves.

## What We Built

### New Data Source: Encounter & Admission Medication Data

We added a clinically relevant data source to our OpenEMR agent: **encounter/admission data** including hospital course notes, admission medications with reconciliation status, and a document store for AI-generated clinical documents.

**New interfaces:**
- `EncounterData` -- inpatient/outpatient encounters with diagnoses, procedures, hospital course
- `AdmissionMedication` -- medication status tracking (continued/modified/discontinued/new)
- `DocumentRecord` -- CRUD document store for discharge summaries and med reconciliation reports

### Agent Access via Open Source API

The agent accesses OpenEMR data through two paths:
1. **MockDataSource** for development/testing (4 mock patients with realistic clinical scenarios)
2. **FhirDataSource** for production OpenEMR instances via FHIR R4 API with OAuth2 password grant

FHIR resources used:
- `Encounter` -- patient encounter history
- `MedicationRequest` -- admission medication reconciliation
- `DocumentReference` -- document CRUD (create/read/update/delete)

OAuth scope extended to include: `user/Encounter.read user/DocumentReference.read user/DocumentReference.write`

### Stateful CRUD Operations

The agent uses full CRUD operations on a `DocumentRecord` store:

| Operation | Method | Description |
|-----------|--------|-------------|
| **Create** | `saveDocument()` | Agent saves drafted document as "draft" status |
| **Read** | `getDocument()` | Retrieve a document by ID |
| **Update** | `updateDocument()` | Clinician finalizes draft via `POST /api/documents/:id/finalize` |
| **Delete** | `deleteDocument()` | Remove a draft document |

The key architectural decision: **AI never writes directly to the chart**. All documents are saved as "draft" and require explicit clinician approval via the "Finalize & Save to Chart" button in the UI.

### 4 New Tools

| Tool | Purpose |
|------|---------|
| `get_encounter_data` | Retrieves encounter/admission data for a patient |
| `reconcile_medications` | Compares admission vs discharge meds, categorizes changes |
| `draft_discharge_summary` | Gathers all data needed for a discharge summary |
| `save_to_chart` | Saves a drafted document to the patient's chart (as draft) |

### Verification Layer Integration

The existing safety verification layer was extended to scan new tool outputs:
- `reconcile_medications` triggers alerts for modified, new, and discontinued medications
- `draft_discharge_summary` flags critical lab values at discharge
- `save_to_chart` generates a confirmation alert showing the draft was saved

### End-to-End Workflow

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

## Impact

- **Time saved**: A discharge summary that takes 30-60 minutes to write manually can be drafted in seconds
- **Safety improved**: Automated medication reconciliation catches changes that manual review might miss
- **HIPAA-compatible**: Draft-then-confirm pattern means AI assists but doesn't make clinical decisions
- **Integrated**: Works within the OpenEMR workflow via FHIR R4 API

## Technical Stats

- **183 unit tests** passing (7 new FHIR mapper tests + 64 bounty feature tests)
- **59 eval cases** covering all new tools and workflows
- **9 tools** total (5 original + 4 bounty)
- **3 new server endpoints** for document CRUD
- **TDD throughout** -- every feature was test-driven

## Files Changed

| File | Change |
|------|--------|
| `src/data/datasource.ts` | +3 interfaces, +6 DataSource methods |
| `src/data/mock-data.json` | +encounters, +admission_medications |
| `src/data/mock-datasource.ts` | +6 method implementations |
| `src/tools/get-encounter-data.ts` | NEW |
| `src/tools/reconcile-medications.ts` | NEW |
| `src/tools/draft-discharge-summary.ts` | NEW |
| `src/tools/save-to-chart.ts` | NEW |
| `src/verification/verification.ts` | +med rec, discharge, save alerts |
| `src/agent.ts` | +4 tools, updated system prompt |
| `src/server.ts` | +finalize, get, delete document endpoints |
| `public/index.html` | +quick prompts, tool badges, finalize button |
| `src/data/fhir-datasource.ts` | +Encounter, DocumentReference, admission meds |
| `src/data/fhir-mappers.ts` | +mapFhirEncounters, mapFhirAdmissionMedications |
| `src/data/fhir-auth.ts` | +FHIR_SCOPES with Encounter + DocumentReference |
| `eval/test-cases.json` | +12 bounty eval cases |
