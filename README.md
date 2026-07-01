# OpenEMR Clinical Query Agent

AI-powered clinical query agent for OpenEMR. Handles discharge summaries, medication reconciliation, drug interactions, and patient-friendly discharge instructions — all via natural language. Built for the AgentForge / Gauntlet AI bounty.

**Live Demo:** https://agent-production-6f7a.up.railway.app

## Architecture

![Architecture Diagram](docs/architecture-diagram.svg)

**Agent:** LangChain.js + Claude Sonnet 4.5 (`claude-sonnet-4-5`, configurable via the `MODEL` env var) using `createToolCallingAgent` with native tool-calling. The agent reasons over clinical queries, selects from 10 tools, executes multi-step workflows (up to 6 iterations), and synthesizes results with source attribution and safety verification.

**10 Tools:**

| Tool | Purpose |
|------|---------|
| `get_patient_summary` | Demographics, conditions, medications, allergies, vitals |
| `get_medications` | Active medication list with dose, frequency, prescriber |
| `drug_interaction_check` | Pairwise interaction check with severity gating |
| `allergy_check` | Direct + cross-reactivity allergy matching |
| `get_lab_results` | Lab values with normal/abnormal/critical flags |
| `get_encounter_data` | Hospital encounters, diagnoses, procedures, course notes |
| `reconcile_medications` | Admission vs. discharge medication comparison |
| `draft_discharge_summary` | Multi-source aggregation into structured clinician-facing summary |
| `generate_discharge_instructions` | Patient-facing instructions + DailyMed education + appointments |
| `save_to_chart` | Stateful document CRUD with draft/finalize workflow |

**Data Sources:**
- **Mock JSON** or **OpenEMR FHIR R4** — Patient data via configurable `DATA_SOURCE` env var
- **DailyMed REST API** (NLM/NIH) — FDA-approved drug labeling for patient education
- **OpenFDA** — Drug interaction label data

**Verification Layer:** Post-LLM safety checks on every response — drug interaction severity gate, allergy conflict detection, critical lab flagging, medication change alerts, source attribution, and medical disclaimer.

**Observability:** Langfuse tracing (OpenTelemetry) with per-request spans and session grouping. Each API response carries a local `request_id` for server-log correlation and a `trace_id` that holds the real provider trace id when a span is active (otherwise `null` — never a fabricated id); traces are correlated in Langfuse by `session_id`.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture documentation.

## npm Package

Available on npm: [`agentforge-clinical-agent`](https://www.npmjs.com/package/agentforge-clinical-agent)

## Eval Results

![Eval Results](docs/eval-results-summary.svg)

**125 eval cases** across 28 categories — **87.2% pass rate** (109/125), **substring-graded** (keyword assertions, not the LLM-judge rubric) on a **historical run** against the now-retired `claude-sonnet-4-20250514`. The current default model is `claude-sonnet-4-5`; these numbers have not been re-measured on it. p50 latency 6.2s, p95 28.4s.

**Performance targets met: 4 of 7.** Met: golden-set 100%, eval pass ≥80%, hallucination ≤5% (3.2%), verification ≥90% (99.2%). **Missed:** single-tool latency (6986ms avg vs 5000), multi-step latency (24914ms vs 15000), tool success rate (94.0% vs 95%). Full breakdown and provenance in [docs/eval-results.md](docs/eval-results.md). The LLM-as-judge rubric is a separate opt-in pass (`npm run eval -- --rubric`).

Eval cases passed per category (substring-graded; the `latency` row counts the 3 latency *test cases* that passed, not the latency performance targets above):

| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Golden Sets | 10 | 10 | 100% |
| Bounty: Encounters | 3 | 3 | 100% |
| Bounty: Discharge | 2 | 2 | 100% |
| Bounty: Workflows | 2 | 2 | 100% |
| Bounty: Edge Cases | 1 | 1 | 100% |
| Bounty: Safety | 2 | 2 | 100% |
| Bounty: Discharge Instr. | 4 | 4 | 100% |
| Appointments | 3 | 3 | 100% |
| DailyMed | 2 | 2 | 100% |
| Workflows | 3 | 3 | 100% |
| Ambiguous | 4 | 4 | 100% |
| Knowledge Boundary | 3 | 3 | 100% |
| Multi-Turn Chain | 3 | 3 | 100% |
| Robustness | 3 | 3 | 100% |
| Consistency | 2 | 2 | 100% |
| Latency | 3 | 3 | 100% |
| PHI Boundary | 3 | 3 | 100% |
| Adversarial | 20 | 22 | 91% |
| Query Variation | 7 | 8 | 88% |
| Safety | 6 | 7 | 86% |
| Drug Interactions | 4 | 5 | 80% |
| Out of Domain | 3 | 4 | 75% |
| Edge Cases | 6 | 9 | 67% |
| Typo Resilience | 2 | 3 | 67% |
| Conversation History | 2 | 3 | 67% |
| Multi-tool | 3 | 5 | 60% |
| Complex Queries | 2 | 4 | 50% |
| Bounty: Med Rec | 1 | 2 | 50% |

See [evals.md](evals.md) for the full eval framework docs.

## Current Evidence

A precise separation of what is **verified now** vs. **historical** vs. **proposed**, so every claim can be cross-checked against the repo.

**Verified current behavior** (reproducible from a clean clone)
- `npm test` → **494 unit tests passing** (+ 9 integration tests skipped behind flags); `npx tsc --noEmit` clean. Validated in CI (`.github/workflows/ci.yml`).
- Default model is `claude-sonnet-4-5` (override via the `MODEL` env var). The previous `claude-sonnet-4-20250514` was retired by the provider and now 404s.
- Each API response returns a local `request_id` and a `trace_id` that holds the real OpenTelemetry/Langfuse trace id when a span is active, otherwise `null` — never a fabricated id. Langfuse correlation key is `session_id`.
- The LLM-as-judge rubric is operational and opt-in (`npm run eval -- --rubric`; judge model `claude-haiku-4-5-20251001`). It fails **loudly** when misconfigured instead of silently scoring `-1`.

**Historical results** (not re-measured on the current model)
- Eval pass rate **87.2% (109/125)**, **substring-graded**, from a 2026-03-02 run on the now-retired Sonnet 4. **4 of 7** performance targets met; p95 latency **28.4s**. Source of truth: `eval/results.json`; breakdown in [docs/eval-results.md](docs/eval-results.md). `rubric_avg_score` is `"N/A"` there because the rubric is a separate pass that was not run.

**Proposed / production hardening** (designed, not implemented)
- Authentication + RBAC, pre-execution patient-scope guard, encrypted session storage, real-trace-id capture wiring, cost/token capture in the eval harness, automated eval-on-PR in CI. See [FUTURE_WORK.md](FUTURE_WORK.md).

**Known limitations**
- Demo-grade security posture (not HIPAA-compliant); prompt-injection defense is detection-only (advisory, non-blocking); drug-interaction severity is heuristic; the OpenEMR iframe module is a thin shell. All catalogued in [FUTURE_WORK.md](FUTURE_WORK.md).

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

## Setup

```bash
git clone https://github.com/robin-raq/agentforge-openemr.git
cd agentforge-openemr
npm install
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY (required).
# MODEL defaults to claude-sonnet-4-5; override to pin a snapshot or a cheaper model.
# Optional: LANGFUSE_SECRET_KEY + LANGFUSE_PUBLIC_KEY for observability.
```

## Run

```bash
npm run dev    # Development with hot reload
npm start      # Production
```

Open http://localhost:3000 (local) or https://agent-production-6f7a.up.railway.app (production)

## Test

```bash
npm test       # Run 494 unit tests (Vitest)
npm run eval   # Run 125 eval cases (requires ANTHROPIC_API_KEY)
```

## FHIR Data Source (OpenEMR Docker)

To use real patient data from OpenEMR:

1. Start OpenEMR Docker: `docker compose up -d` in `docker/development-easy/`
2. Register OAuth2 client: `./scripts/register-oauth-client.sh`
3. Add `FHIR_CLIENT_ID` (and `FHIR_CLIENT_SECRET` if returned) to `.env`
4. Set `DATA_SOURCE=fhir` in `.env`
5. For self-signed certs: uncomment `NODE_TLS_REJECT_UNAUTHORIZED=1` in `.env` (dev only)
6. Restart the server

For iframe embedding from OpenEMR, set `OPENEMR_ORIGINS=https://localhost:8300` (or your OpenEMR origin). The chat UI reads `?pid=` from the URL to auto-select the patient.

### Add Mock Patients from FHIR

To pull patients from OpenEMR FHIR into `mock-data.json` (for demos without FHIR):

```bash
# Ensure FHIR_* vars are set in .env, then:
npm run fetch-mock              # Add up to 20 patients (keeps existing 1-4)
npm run fetch-mock -- --limit 50  # Fetch up to 50
npm run fetch-mock -- --replace   # Replace mock data entirely
```

The patient dropdown loads from `GET /api/patients`, which reads from mock data or FHIR depending on `DATA_SOURCE`.

## Security

The agent runs with **mock data by default** (`DATA_SOURCE=mock`) — no real PHI is exposed in the default configuration. The following security controls are implemented, along with known limitations for production hardening (this is a **demo-grade** posture, not a HIPAA-compliant deployment — see [FUTURE_WORK.md](FUTURE_WORK.md)).

**Implemented Controls:**

| Control | Implementation |
|---------|---------------|
| Input validation | Zod schemas on all tool inputs; regex validation on patient IDs, session IDs, document IDs |
| Rate limiting | 10 req/min per IP with configurable window (`server.ts`) |
| Prompt injection detection | 10 regex patterns flag likely-injection inputs and reinforce the system prompt — **detection is advisory, it does not block the request** |
| Patient scope enforcement | **Post-execution** check blocks cross-patient data from appearing in responses (a tool may execute before the block fires; pre-execution guard is future work) |
| Security headers | X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP |
| CORS | Configurable allowed origins; credentials restricted to explicit origins |
| Session management | Server-generated UUIDs, auto-cleanup via TTL, max history depth |
| Secrets protection | `.env` gitignored; placeholder detection warns on unconfigured keys |
| Content-Type enforcement | POST/PUT require `application/json`; body limited to 50KB |
| Audit logging | Request logging with patient ID, session, tool usage, safety alerts |

See [FUTURE_WORK.md](FUTURE_WORK.md) for known limitations, security hardening roadmap, and planned improvements.

## Submission Checklist

**Deadline:** Sunday 10:59 PM CT

| Deliverable | Status | Link |
|-------------|--------|------|
| GitHub Repository | :white_check_mark: Setup guide, architecture overview, deployed link | [repo](https://github.com/robin-raq/agentforge-openemr) |
| Demo Video (3-5 min) | :white_check_mark: Agent in action, eval results, observability dashboard | Submitted |
| Pre-Search Document | :white_check_mark: Completed checklist from Phase 1-3 | Submitted |
| Agent Architecture Doc | :white_check_mark: 1-2 page breakdown | [ARCHITECTURE.md](ARCHITECTURE.md) |
| AI Cost Analysis | :white_check_mark: Dev spend + projections for 100/1K/10K/100K users | [AI_COST_ANALYSIS.md](AI_COST_ANALYSIS.md) |
| Eval Dataset | :white_check_mark: 125 test cases, 87.2% pass (substring-graded, historical; 4/7 perf targets) | [eval/test-cases.json](eval/test-cases.json) \| [results](docs/eval-results.md) |
| Open Source Link | :white_check_mark: Published npm package | [agentforge-clinical-agent](https://www.npmjs.com/package/agentforge-clinical-agent) |
| Deployed Application | :white_check_mark: Publicly accessible agent interface | [Railway](https://agent-production-6f7a.up.railway.app) |
| Evaluation Framework | :white_check_mark: Correctness, tool selection, safety, adversarial, edge cases | [evals.md](evals.md) |
| Social Post | :white_check_mark: Shared on LinkedIn | Submitted |

## MVP Requirements

- [x] Agent responds to NL queries in healthcare domain
- [x] 3+ functional tools (10 implemented)
- [x] Tool calls execute and return structured results
- [x] Agent synthesizes tool results
- [x] Conversation history maintained
- [x] Basic error handling
- [x] Domain-specific verification (drug interaction severity gate)
- [x] 50+ eval test cases (125 implemented)
- [x] Deployed and publicly accessible (Railway)
- [x] BOUNTY.md with customer, features, data source, impact
- [x] New data source (DailyMed REST API)
- [x] Stateful CRUD operations (document draft/edit/finalize)
