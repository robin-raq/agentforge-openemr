# Security and Clinical Safety

## Intended use

This repository is a bounty/demo implementation. It is not a HIPAA-compliant deployment, a medical device, or a substitute for clinician judgment. Mock data is the default and should remain the only data used in the public demo.

## Implemented controls

- Zod validation for tool inputs.
- Read-oriented clinical retrieval tools.
- Six-iteration and request-time limits.
- Explicit draft/edit/finalize document workflow.
- Deterministic alerts for serious drug interactions, allergy conflicts, critical labs, and medication changes.
- Source-attribution and medical-disclaimer checks.
- Rate limiting, CORS configuration, and content-security policy.
- Environment-based secrets excluded from version control.
- Production TLS verification expected; local certificate bypass is development-only.

These controls reduce risk but do not establish production safety.

## Production blockers

| Gap | Risk |
|---|---|
| No application authentication or RBAC | Users and roles cannot be reliably established |
| Document endpoints lack patient- and clinician-level authorization | Drafts may be accessed or changed outside intended scope |
| Patient scope is checked after tool execution | Data can be retrieved before a response is rejected |
| Session and document storage are not durable encrypted clinical stores | Confidentiality, integrity, and recovery are insufficient |
| Public drug-interaction sources are not licensed clinical decision-support data | Coverage and authority are inadequate for clinical reliance |
| Clinical validation is limited to synthetic scenarios | Safety and effectiveness are not established on real workflows |
| Complete audit logging and retention policy are absent | Clinical accountability and incident review are incomplete |

Do not connect real PHI until identity, authorization, pre-execution patient scoping, encrypted persistence, auditability, retention, deployment controls, and organizational compliance review are complete.

## Clinical review boundary

Generated summaries and instructions remain drafts until a qualified clinician reviews and finalizes them. Verification alerts are deterministic checks over available tool results; absence of an alert does not prove a response safe or complete.

## Reporting

Do not open a public issue containing PHI, credentials, tokens, or vulnerability details. Remove sensitive material and contact the repository owner privately for security-sensitive reports.
