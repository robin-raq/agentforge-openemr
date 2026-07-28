# AgentForge Bounty Submission

## Customer and problem

The target user is a clinician completing an OpenEMR discharge workflow. Medication reconciliation and discharge documentation are time-consuming and error-prone, while patients need clear medication changes, follow-up appointments, warning signs, and sources.

This project demonstrates an agent-assisted workflow with clinician review rather than autonomous charting or medical decision-making.

## Submitted capabilities

- Natural-language clinical queries backed by ten structured tools.
- OpenEMR FHIR R4 integration with mock data as the default.
- DailyMed medication education.
- Encounter retrieval and medication reconciliation.
- Draft discharge summaries and patient instructions.
- Editable drafts with explicit finalization.
- Scheduled follow-up appointments in discharge instructions.
- Deterministic post-response safety alerts.
- Conversation history and source attribution.
- Optional Langfuse tracing.
- Published `agentforge-clinical-agent` npm package.

## Bounty-specific tools

| Tool | Capability |
|---|---|
| `get_encounter_data` | Admission and encounter context |
| `reconcile_medications` | Admission versus discharge changes |
| `draft_discharge_summary` | Structured clinician-reviewable draft |
| `generate_discharge_instructions` | Patient instructions, DailyMed education, and appointments |
| `save_to_chart` | Draft/edit/finalize document workflow |

The remaining five tools provide patient summaries, medications, labs, allergy checks, and drug-interaction checks.

## Data-source contribution

DailyMed is a new public NLM/NIH data source used for medication warnings, adverse effects, and patient education. OpenEMR FHIR provides the clinical record boundary. Mock data remains the default so the public demo does not require real PHI.

## Safety and verification

The implementation validates tool inputs, limits tool iterations, keeps clinical retrieval tools read-only, requires explicit document finalization, and deterministically surfaces serious interactions, allergies, critical labs, medication changes, missing sources, and missing disclaimers.

This is demo-grade software, not a HIPAA-compliant deployment. Production blockers are documented in [SECURITY.md](SECURITY.md).

## Evidence

- 494 unit tests pass; 9 credential-dependent integration tests are skipped by default.
- The dataset contains 125 evaluation cases across all ten tools.
- Current Sonnet 4.5 run: 81.6% substring pass and 82.4% rubric pass.
- Historical retired-model baseline: 87.2% substring pass.
- CI runs install, lint, type checking, unit tests, and build.

See [evaluation methodology](evals.md) and [results](docs/eval-results.md).

## Deliverables

- [Repository](https://github.com/robin-raq/agentforge-openemr)
- [Live demo](https://agent-production-6f7a.up.railway.app)
- [npm package](https://www.npmjs.com/package/agentforge-clinical-agent)
- Architecture and evaluation documentation
- Demo video and pre-search submission supplied through the bounty workflow
