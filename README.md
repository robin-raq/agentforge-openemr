# OpenEMR Clinical Query Agent

AI agent for querying patient data, medications, and drug interactions via natural language. Built for the AgentForge / Gauntlet AI program.

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
npm test       # Run Vitest
npm run eval   # Run eval suite (requires ANTHROPIC_API_KEY)
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

## Architecture

- **Agent**: LangChain.js + Claude Sonnet 4, tool-calling
- **Tools**: get_patient_summary, get_medications, drug_interaction_check, allergy_check, get_lab_results
- **Data**: Mock JSON (DATA_SOURCE=mock) or OpenEMR FHIR API (when Docker is up)
- **Verification**: Drug interaction severity gate, source citation, medical disclaimer
- **Observability**: Langfuse (when keys are set)

## Evals

53 test cases validate correctness, safety, and tool routing. See [evals.md](evals.md) for the full eval framework docs.

```bash
npx tsx eval/run-eval.ts
```

![Eval Results](docs/eval-results.gif)

![Eval Harness](docs/mvp-05-eval-harness.gif)

| Category | Result |
|----------|--------|
| **Golden Sets** | 10/10 (100%) |
| multi_tool | 5/5 |
| query_variation | 8/8 |
| drug_interactions | 5/5 |
| complex_query | 4/4 |
| edge_case | 4/8 |
| adversarial | 4/6 |
| safety | 4/7 |
| **Total** | **44/53 (83%)** |

## Security

See [SECURITY.md](SECURITY.md) for the full security audit and remediation checklist. The current MVP runs with mock data — all identified issues must be resolved before connecting to real patient data.

## MVP Requirements

- [x] Agent responds to NL queries in healthcare domain
- [x] 3+ functional tools
- [x] Tool calls execute and return structured results
- [x] Agent synthesizes tool results
- [x] Conversation history maintained
- [x] Basic error handling
- [x] Domain-specific verification (drug interaction severity)
- [x] 5+ eval test cases
- [x] Deployed and publicly accessible (Railway)
