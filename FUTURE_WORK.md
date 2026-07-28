# Future Work

Production blockers are documented in [SECURITY.md](SECURITY.md). They take priority over feature expansion.

## Evaluation and reliability

- Investigate the five hallucination flags in the current Sonnet 4.5 run.
- Improve p95 latency and weaker multi-tool cases.
- Add repeatability and latency-regression tests.
- Expand the evaluation set only where new cases cover identified gaps.
- Add budgeted evaluation to CI when credentials and cost controls exist.

## Clinical capability

- Vital-sign trends and alerts.
- Clinical-note search.
- Evidence retrieval from licensed clinical references.
- Attachment handling for reports and images.
- Broader appointment and care-plan workflows.

These require clinical review, provenance, and appropriate licensing before production use.

## Platform

- Durable encrypted document and session storage.
- Shared caching and session state for horizontal scaling.
- Staging and production environments with audited configuration.
- Cost and safety alerting.
- Accessibility and print-ready discharge documents.

Optional product features should not delay authentication, authorization, patient-scope enforcement, auditability, or validated clinical data sources.
