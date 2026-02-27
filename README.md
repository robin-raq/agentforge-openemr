# OpenEMR Clinical Query Agent

AI-powered clinical query agent for OpenEMR. Handles discharge summaries, medication reconciliation, drug interactions, and patient-friendly discharge instructions — all via natural language. Built for the AgentForge / Gauntlet AI bounty.

**Live Demo:** https://agent-production-6f7a.up.railway.app

## Eval Results

![Eval Results](docs/eval-results-summary.svg)

**79 eval cases** across 12 categories — 97.5% pass rate on 10 tools.

| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Golden Sets | 10 | 10 | 100% |
| Multi-tool | 5 | 5 | 100% |
| Edge Cases | 8 | 9 | 89% |
| Adversarial | 7 | 7 | 100% |
| Safety | 6 | 7 | 86% |
| Query Variation | 8 | 8 | 100% |
| Drug Interactions | 5 | 5 | 100% |
| Complex Queries | 4 | 4 | 100% |
| Bounty Tools | 12 | 12 | 100% |
| Discharge Instructions | 7 | 7 | 100% |
| DailyMed | 2 | 2 | 100% |
| Workflows | 3 | 3 | 100% |

See [evals.md](evals.md) for the full eval framework docs.

## Setup

```bash
cd openemr/agent
npm install
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY (required)
# Optional: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY for observability
```

## Run

```bash
npm run dev    # Development with hot reload
npm start      # Production
```

Open http://localhost:3000 (local) or https://agent-production-6f7a.up.railway.app (production)

## Test

```bash
npm test       # Run 232 unit tests (Vitest)
npm run eval   # Run 79 eval cases (requires ANTHROPIC_API_KEY)
```

## Architecture

- **Agent**: LangChain.js + Claude Sonnet 4, tool-calling with `createToolCallingAgent`
- **10 Tools**: get_patient_summary, get_medications, drug_interaction_check, allergy_check, get_lab_results, get_encounter_data, reconcile_medications, draft_discharge_summary, generate_discharge_instructions, save_to_chart
- **Data Sources**: Mock JSON (DATA_SOURCE=mock) or OpenEMR FHIR R4 API (DATA_SOURCE=fhir) + DailyMed REST API (NLM/NIH) for drug education
- **Stateful CRUD**: Documents with create/read/update/finalize — editable drafts with clinician review before finalization
- **Verification**: Drug interaction severity gate, source attribution, medical disclaimer
- **Observability**: Langfuse tracing (when keys are set)
- **UI**: Patient selector, quick prompt buttons, tool badges, feedback buttons, editable discharge drafts

## Bounty Features

### New Data Source: DailyMed (NLM/NIH)
FDA-approved drug labeling data fetched from the [DailyMed REST API](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm). Integrated into discharge instructions for patient-friendly drug education with side effects, warnings, and proper citations.

### 5 Bounty Tools
1. **get_encounter_data** — Retrieve hospital encounter/admission details
2. **reconcile_medications** — Compare admission vs. discharge medications, flag changes
3. **draft_discharge_summary** — AI-generated comprehensive discharge summary
4. **generate_discharge_instructions** — Patient-friendly instructions with DailyMed drug education + scheduled follow-up appointments
5. **save_to_chart** — Stateful document CRUD with draft/finalize workflow

### Editable Discharge Drafts
Practitioners can review and edit AI-drafted discharge notes before finalizing. Edit Draft button opens an editable textarea; Save Edit persists changes; Finalize locks the document to the chart.

### Scheduled Appointments
Discharge instructions include actual scheduled follow-up appointments with provider name, specialty, date, time, and location.

## FHIR Data Source (OpenEMR Docker)

To use real patient data from OpenEMR:

1. Start OpenEMR Docker: `docker compose up -d` in `docker/development-easy/`
2. Register OAuth2 client: `./scripts/register-oauth-client.sh`
3. Add `FHIR_CLIENT_ID` (and `FHIR_CLIENT_SECRET` if returned) to `.env`
4. Set `DATA_SOURCE=fhir` in `.env`
5. For self-signed certs: uncomment `NODE_TLS_REJECT_UNAUTHORIZED=1` in `.env` (dev only)
6. Restart the server

For iframe embedding from OpenEMR, set `OPENEMR_ORIGINS=https://localhost:8300` (or your OpenEMR origin). The chat UI reads `?pid=` from the URL to auto-select the patient.

## Security

See [SECURITY.md](SECURITY.md) for the full security audit and remediation checklist. The current MVP runs with mock data — all identified issues must be resolved before connecting to real patient data.

## MVP Requirements

- [x] Agent responds to NL queries in healthcare domain
- [x] 3+ functional tools (10 implemented)
- [x] Tool calls execute and return structured results
- [x] Agent synthesizes tool results
- [x] Conversation history maintained
- [x] Basic error handling
- [x] Domain-specific verification (drug interaction severity gate)
- [x] 50+ eval test cases (79 implemented)
- [x] Deployed and publicly accessible (Railway)
- [x] BOUNTY.md with customer, features, data source, impact
- [x] New data source (DailyMed REST API)
- [x] Stateful CRUD operations (document draft/edit/finalize)
