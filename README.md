# OpenEMR Clinical Query Agent

A clinical workflow agent for OpenEMR, built for the AgentForge / Gauntlet AI bounty. It answers natural-language questions, retrieves patient data, checks medication safety, and drafts clinician-reviewable discharge documents.

[Live demo](https://agent-production-6f7a.up.railway.app) · [npm package](https://www.npmjs.com/package/agentforge-clinical-agent)

![Architecture diagram](docs/architecture-diagram.svg)

## What it does

The LangChain.js agent uses Claude Sonnet 4.5 and ten tools to:

- retrieve patient summaries, medications, labs, and encounters;
- check drug interactions and allergy conflicts;
- reconcile admission and discharge medications;
- draft discharge summaries and patient instructions;
- enrich medication guidance with DailyMed labeling;
- save, edit, and finalize chart-document drafts.

The default data source is synthetic mock data. OpenEMR FHIR R4 can be enabled explicitly.

## Current evidence

The current repository state has:

- 494 passing unit tests, with 9 credential-dependent integration tests skipped by default;
- clean TypeScript type checking and CI validation;
- 125 evaluation cases covering all ten tools;
- a full Sonnet 4.5 evaluation from 2026-07-01:
  - 81.6% substring pass (102/125);
  - 82.4% rubric pass (103/125), average 4.34/5;
  - 7.5s p50 and 34.3s p95 latency;
  - zero scope violations and five hallucination flags;
  - $1.66 total recorded model cost.

The older 87.2% result is a historical substring-graded baseline on the retired `claude-sonnet-4-20250514` model. Its category breakdown is preserved for comparison, not presented as current performance.

See [evaluation methodology](evals.md) and [full results with provenance](docs/eval-results.md).

## Setup

Requirements: Node.js 20+ and an Anthropic API key.

```bash
git clone https://github.com/robin-raq/agentforge-openemr.git
cd agentforge-openemr
npm install
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env
npm run dev
```

Open `http://localhost:3000`.

The default model is `claude-sonnet-4-5`; override it with `MODEL`.

## Test and evaluate

```bash
npm test
npm run typecheck
npm run lint
npm run eval
npm run eval -- --rubric
```

Evaluation makes paid model calls and requires `ANTHROPIC_API_KEY`. Unit tests run without live model calls.

## OpenEMR FHIR

To use an OpenEMR instance instead of mock data:

1. Start OpenEMR from `docker/development-easy/`.
2. Run `./scripts/register-oauth-client.sh`.
3. Set the returned FHIR credentials and `DATA_SOURCE=fhir` in `.env`.
4. Restart the application.

For local self-signed certificates, use the development-only TLS setting documented in `.env.example`. Do not disable certificate validation in production.

`npm run fetch-mock` can import FHIR patients into the local mock dataset for demonstrations.

## Safety boundary

This is a demo, not a HIPAA-compliant clinical deployment. It uses mock data by default and provides input validation, read-only clinical retrieval tools, explicit document finalization, post-response clinical warnings, rate limiting, CSP, and source attribution.

It does not provide production authentication, role-based access control, pre-execution patient-scope enforcement, durable encrypted clinical storage, or a licensed drug-interaction knowledge base. See [SECURITY.md](SECURITY.md).

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Bounty requirements and impact](BOUNTY.md)
- [Evaluation framework](evals.md)
- [Evaluation results](docs/eval-results.md)
- [Security posture](SECURITY.md)
- [AI usage](AI_USAGE.md)
- [Cost evidence and assumptions](AI_COST_ANALYSIS.md)
- [Future work](FUTURE_WORK.md)
