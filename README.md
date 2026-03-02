# OpenEMR Clinical Query Agent

AI-powered clinical query agent for OpenEMR. Handles discharge summaries, medication reconciliation, drug interactions, and patient-friendly discharge instructions — all via natural language. Built for the AgentForge / Gauntlet AI bounty.

**Live Demo:** https://agent-production-6f7a.up.railway.app

## Architecture

![Architecture Diagram](docs/architecture-diagram.svg)

**Agent:** LangChain.js + Claude Sonnet 4 using `createToolCallingAgent` with native tool-calling. The agent reasons over clinical queries, selects from 10 tools, executes multi-step workflows (up to 6 iterations), and synthesizes results with source attribution and safety verification.

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

**Observability:** Langfuse tracing with per-request spans, session grouping, and feedback correlation.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture documentation.

## npm Package

Available on npm: [`agentforge-clinical-agent`](https://www.npmjs.com/package/agentforge-clinical-agent)

## Eval Results

![Eval Results](docs/eval-results-summary.svg)

**125 eval cases** across 28 categories — **87.2% pass rate** (109/125) on all 10 tools. p50 latency: 6.2s, p95: 28.4s.

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
npm test       # Run 479 unit tests (Vitest)
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

## Security

The agent runs with **mock data by default** — no real PHI is exposed. The following security controls are implemented, along with known limitations for production hardening.

**Implemented Controls:**

| Control | Implementation |
|---------|---------------|
| Input validation | Zod schemas on all tool inputs; regex validation on patient IDs, session IDs, document IDs |
| Rate limiting | 10 req/min per IP with configurable window (`server.ts`) |
| Prompt injection detection | 10 regex patterns + system prompt reinforcement on detection |
| Patient scope enforcement | Post-execution verification blocks cross-patient data in responses |
| Security headers | X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP |
| CORS | Configurable allowed origins; credentials restricted to explicit origins |
| Session management | Server-generated UUIDs, auto-cleanup via TTL, max history depth |
| Secrets protection | `.env` gitignored; placeholder detection warns on unconfigured keys |
| Content-Type enforcement | POST/PUT require `application/json`; body limited to 50KB |
| Audit logging | Request logging with patient ID, session, tool usage, safety alerts |

**Known Limitations (MVP — not production-ready):**

| Finding | Severity | Notes |
|---------|----------|-------|
| No authentication layer | High | No user auth; relies on network-level access control (OpenEMR iframe) |
| Document endpoints lack authorization | High | CRUD operations on `/api/documents/:id` have no patient-scope or role checks |
| Patient scope is post-execution | Medium | Tools execute before scope violation is detected; data accessed but response blocked |
| Session history persisted in plaintext | Medium | `data/sessions.json` contains chat history unencrypted on disk |
| TLS verification disabled in dev | Medium | `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs; must enable in production |
| CSP allows `unsafe-inline` | Low | Required for current inline JS/CSS; extract to separate files to remove |
| No CSRF tokens | Medium | State-changing endpoints unprotected; mitigated by CORS origin restriction |
| Regex-based injection detection | Low | Bypassable via encoding/homoglyphs; defense-in-depth with LLM system prompt |

> **Production checklist:** Add authentication middleware, encrypt session storage, enable TLS verification, add CSRF tokens, implement document-level authorization, move patient scope enforcement before tool execution.

## Submission Checklist

**Deadline:** Sunday 10:59 PM CT

| Deliverable | Status | Link |
|-------------|--------|------|
| GitHub Repository | :white_check_mark: Setup guide, architecture overview, deployed link | [repo](https://github.com/robin-raq/agentforge-openemr) |
| Demo Video (3-5 min) | :white_check_mark: Agent in action, eval results, observability dashboard | Submitted |
| Pre-Search Document | :white_check_mark: Completed checklist from Phase 1-3 | Submitted |
| Agent Architecture Doc | :white_check_mark: 1-2 page breakdown | [ARCHITECTURE.md](ARCHITECTURE.md) |
| AI Cost Analysis | :white_check_mark: Dev spend + projections for 100/1K/10K/100K users | [AI_COST_ANALYSIS.md](AI_COST_ANALYSIS.md) |
| Eval Dataset | :white_check_mark: 125 test cases with results (87.2% pass rate) | [eval/test-cases.json](eval/test-cases.json) \| [results](docs/eval-results.md) |
| Open Source Link | :white_check_mark: Published npm package | [agentforge-clinical-agent](https://www.npmjs.com/package/agentforge-clinical-agent) |
| Deployed Application | :white_check_mark: Publicly accessible agent interface | [Railway](https://agent-production-6f7a.up.railway.app) |
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
